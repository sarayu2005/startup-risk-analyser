from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import MinMaxScaler
from sklearn.pipeline import Pipeline
import shap
import json
import anthropic
import os
import warnings
warnings.filterwarnings('ignore')

app = Flask(__name__)
CORS(app)

# ─────────────────────────────────────────────
#  SYNTHETIC TRAINING DATA GENERATOR
# ─────────────────────────────────────────────
def generate_training_data(n=1000):
    np.random.seed(42)
    data = []
    for _ in range(n):
        stage = np.random.choice(['pre-seed', 'seed', 'series-a'], p=[0.4, 0.4, 0.2])
        funding = {'pre-seed': np.random.uniform(50000, 500000),
                   'seed': np.random.uniform(500000, 3000000),
                   'series-a': np.random.uniform(3000000, 15000000)}[stage]

        burn_rate = np.random.uniform(5000, 200000)
        revenue = np.random.uniform(0, funding * 0.3)
        team_size = np.random.randint(1, 30)
        prior_exits = np.random.choice([0, 1], p=[0.7, 0.3])
        domain_exp = np.random.uniform(0, 20)
        months_since_launch = np.random.uniform(0, 36)
        paying_customers = np.random.randint(0, 500)
        tam = np.random.choice([1, 2, 3])  # 1=small, 2=medium, 3=large
        pivot_count = np.random.randint(0, 5)

        # Derived features
        runway = funding / burn_rate if burn_rate > 0 else 0
        efficiency = revenue / funding if funding > 0 else 0
        revenue_growth = np.random.uniform(-0.1, 0.5)
        churn_rate = np.random.uniform(0.01, 0.30)

        # Risk label logic (higher = riskier)
        risk_score = 0
        if runway < 6: risk_score += 3
        elif runway < 12: risk_score += 1
        if efficiency < 0.05: risk_score += 2
        if prior_exits == 0: risk_score += 1
        if domain_exp < 3: risk_score += 1
        if paying_customers < 10: risk_score += 2
        if pivot_count > 2: risk_score += 1
        if revenue_growth < 0: risk_score += 2
        if churn_rate > 0.15: risk_score += 2
        if team_size < 2: risk_score += 1

        label = 1 if risk_score >= 5 else 0  # 1 = High Risk

        data.append({
            'funding': funding,
            'burn_rate': burn_rate,
            'revenue': revenue,
            'team_size': team_size,
            'prior_exits': prior_exits,
            'domain_exp': domain_exp,
            'months_since_launch': months_since_launch,
            'paying_customers': paying_customers,
            'tam': tam,
            'pivot_count': pivot_count,
            'runway': runway,
            'efficiency': efficiency,
            'revenue_growth': revenue_growth,
            'churn_rate': churn_rate,
            'stage_encoded': {'pre-seed': 0, 'seed': 1, 'series-a': 2}[stage],
            'label': label
        })

    return pd.DataFrame(data)

# ─────────────────────────────────────────────
#  TRAIN MODELS
# ─────────────────────────────────────────────
FEATURE_COLS = [
    'funding', 'burn_rate', 'revenue', 'team_size', 'prior_exits',
    'domain_exp', 'months_since_launch', 'paying_customers', 'tam',
    'pivot_count', 'runway', 'efficiency', 'revenue_growth',
    'churn_rate', 'stage_encoded'
]

print("🔧 Training models on synthetic data...")
df_train = generate_training_data(1000)
X_train = df_train[FEATURE_COLS]
y_train = df_train['label']

scaler = MinMaxScaler()
X_scaled = scaler.fit_transform(X_train)

# Three models
xgb_model = GradientBoostingClassifier(n_estimators=200, max_depth=4, learning_rate=0.05, random_state=42)
rf_model = RandomForestClassifier(n_estimators=200, max_depth=6, random_state=42)
lr_model = LogisticRegression(max_iter=1000, random_state=42)

xgb_model.fit(X_scaled, y_train)
rf_model.fit(X_scaled, y_train)
lr_model.fit(X_scaled, y_train)

# SHAP explainer on XGBoost
explainer = shap.TreeExplainer(xgb_model)
print("✅ Models trained and ready.")

# ─────────────────────────────────────────────
#  FEATURE ENGINEERING
# ─────────────────────────────────────────────
def engineer_features(raw: dict) -> dict:
    funding = float(raw.get('funding', 0))
    burn_rate = float(raw.get('burnRate', 1))
    revenue = float(raw.get('revenue', 0))
    stage = raw.get('stage', 'pre-seed')
    revenue_growth = float(raw.get('revenueGrowth', 0)) / 100
    churn_rate = float(raw.get('churnRate', 0)) / 100

    runway = funding / burn_rate if burn_rate > 0 else 0
    efficiency = revenue / funding if funding > 0 else 0

    return {
        'funding': funding,
        'burn_rate': burn_rate,
        'revenue': revenue,
        'team_size': float(raw.get('teamSize', 1)),
        'prior_exits': 1 if raw.get('priorExits') == 'yes' else 0,
        'domain_exp': float(raw.get('domainExp', 0)),
        'months_since_launch': float(raw.get('monthsSinceLaunch', 0)),
        'paying_customers': float(raw.get('payingCustomers', 0)),
        'tam': {'small': 1, 'medium': 2, 'large': 3}.get(raw.get('tam', 'medium'), 2),
        'pivot_count': float(raw.get('pivotCount', 0)),
        'runway': runway,
        'efficiency': efficiency,
        'revenue_growth': revenue_growth,
        'churn_rate': churn_rate,
        'stage_encoded': {'pre-seed': 0, 'seed': 1, 'series-a': 2}.get(stage, 0)
    }

# ─────────────────────────────────────────────
#  SHAP ANALYSIS
# ─────────────────────────────────────────────
def get_shap_breakdown(features_dict: dict) -> list:
    row = pd.DataFrame([features_dict])[FEATURE_COLS]
    row_scaled = scaler.transform(row)
    shap_vals = explainer.shap_values(row_scaled)[0]

    readable_names = {
        'funding': 'Total Funding',
        'burn_rate': 'Monthly Burn Rate',
        'revenue': 'Monthly Revenue',
        'team_size': 'Team Size',
        'prior_exits': 'Prior Founder Exits',
        'domain_exp': 'Domain Experience',
        'months_since_launch': 'Time Since Launch',
        'paying_customers': 'Paying Customers',
        'tam': 'Market Size (TAM)',
        'pivot_count': 'Pivot Count',
        'runway': 'Runway (Months)',
        'efficiency': 'Capital Efficiency',
        'revenue_growth': 'Revenue Growth Rate',
        'churn_rate': 'Churn Rate',
        'stage_encoded': 'Funding Stage'
    }

    breakdown = []
    for i, col in enumerate(FEATURE_COLS):
        breakdown.append({
            'factor': readable_names.get(col, col),
            'impact': float(shap_vals[i]),
            'value': float(features_dict[col])
        })

    return sorted(breakdown, key=lambda x: abs(x['impact']), reverse=True)[:8]

# ─────────────────────────────────────────────
#  DIMENSION SCORES (0–100, lower = riskier)
# ─────────────────────────────────────────────
def compute_dimension_scores(f: dict) -> dict:
    runway = f['runway']
    efficiency = f['efficiency']
    churn = f['churn_rate']
    growth = f['revenue_growth']
    customers = f['paying_customers']
    prior_exits = f['prior_exits']
    domain_exp = f['domain_exp']
    team_size = f['team_size']
    pivots = f['pivot_count']
    tam = f['tam']

    financial = np.clip(
        (min(runway, 24) / 24 * 40) +
        (min(efficiency, 0.5) / 0.5 * 30) +
        (max(0, growth) / 0.5 * 30), 0, 100
    )

    team = np.clip(
        (prior_exits * 35) +
        (min(domain_exp, 10) / 10 * 35) +
        (min(team_size, 10) / 10 * 30), 0, 100
    )

    traction = np.clip(
        (min(customers, 200) / 200 * 50) +
        (max(0, 1 - churn / 0.3) * 50), 0, 100
    )

    market = np.clip(
        (tam / 3 * 60) +
        (max(0, 1 - pivots / 4) * 40), 0, 100
    )

    return {
        'Financial Health': round(float(financial)),
        'Team Strength': round(float(team)),
        'Traction': round(float(traction)),
        'Market Position': round(float(market))
    }

# ─────────────────────────────────────────────
#  LLM REPORT GENERATION
# ─────────────────────────────────────────────
def generate_llm_report(raw_input: dict, risk_score: float, risk_label: str,
                         dimensions: dict, shap_breakdown: list) -> str:
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        return generate_fallback_report(raw_input, risk_score, risk_label, dimensions, shap_breakdown)

    client = anthropic.Anthropic(api_key=api_key)

    top_factors = "\n".join([
        f"- {s['factor']}: impact={s['impact']:+.3f}" for s in shap_breakdown[:5]
    ])

    prompt = f"""You are a senior venture capital analyst writing a confidential startup risk assessment report.

STARTUP DATA:
- Name: {raw_input.get('startupName', 'Unnamed')}
- Industry: {raw_input.get('industry', 'Unknown')}
- Stage: {raw_input.get('stage', 'Unknown')}
- Monthly Burn Rate: ${float(raw_input.get('burnRate', 0)):,.0f}
- Total Funding: ${float(raw_input.get('funding', 0)):,.0f}
- Monthly Revenue: ${float(raw_input.get('revenue', 0)):,.0f}
- Revenue Growth (MoM): {raw_input.get('revenueGrowth', 0)}%
- Churn Rate: {raw_input.get('churnRate', 0)}%
- Team Size: {raw_input.get('teamSize', 0)}
- Prior Founder Exits: {raw_input.get('priorExits', 'no')}
- Domain Experience: {raw_input.get('domainExp', 0)} years
- Paying Customers: {raw_input.get('payingCustomers', 0)}
- Pivot Count: {raw_input.get('pivotCount', 0)}
- TAM: {raw_input.get('tam', 'unknown')}

ML RISK SCORE: {risk_score:.1f}/100 ({risk_label})

DIMENSION SCORES (0-100, higher = healthier):
{json.dumps(dimensions, indent=2)}

TOP RISK FACTORS (SHAP analysis):
{top_factors}

Write a structured, professional risk assessment report with these exact sections:

## Executive Summary
2-3 sentences capturing the overall risk profile and most critical insight.

## Key Strengths
3 specific strengths based on the data. Be precise and data-driven.

## Critical Risk Factors  
3-4 specific risks identified. Reference actual numbers from the data.

## Financial Runway Analysis
Analyze the burn rate vs funding. Calculate runway explicitly. Flag if critical.

## Strategic Recommendations
4 prioritized, actionable recommendations. Number them 1-4.

## Verdict
One final paragraph: investment readiness and what would need to change to reduce risk.

Be direct, clinical, and data-driven. No fluff. This is a boardroom document."""

    try:
        message = client.messages.create(
            model="claude-sonnet-4-5-20250929",
            max_tokens=1200,
            messages=[{"role": "user", "content": prompt}]
        )
        return message.content[0].text
    except Exception as e:
        return generate_fallback_report(raw_input, risk_score, risk_label, dimensions, shap_breakdown)


def generate_fallback_report(raw_input, risk_score, risk_label, dimensions, shap_breakdown):
    funding = float(raw_input.get('funding', 0))
    burn = float(raw_input.get('burnRate', 1))
    runway = funding / burn if burn > 0 else 0
    name = raw_input.get('startupName', 'This startup')

    top_risk = shap_breakdown[0]['factor'] if shap_breakdown else 'burn rate'

    return f"""## Executive Summary
{name} presents a **{risk_label}** profile with an overall risk score of **{risk_score:.1f}/100**. The analysis flags {top_risk.lower()} as the primary concern requiring immediate attention.

## Key Strengths
- Funding stage ({raw_input.get('stage', 'N/A')}) is appropriate for current team size of {raw_input.get('teamSize', 'N/A')}
- Market size (TAM: {raw_input.get('tam', 'N/A')}) provides sufficient headroom for growth
- Domain experience of {raw_input.get('domainExp', 0)} years in the team provides operational credibility

## Critical Risk Factors
- **Runway**: At current burn rate of ${burn:,.0f}/month, the startup has **{runway:.1f} months** of runway — {'critical' if runway < 6 else 'concerning' if runway < 12 else 'acceptable'}
- **Traction Score**: {dimensions.get('Traction', 0)}/100 — paying customer base of {raw_input.get('payingCustomers', 0)} needs to grow
- **Churn Rate**: {raw_input.get('churnRate', 0)}% monthly churn {'is dangerously high' if float(raw_input.get('churnRate', 0)) > 10 else 'needs monitoring'}

## Financial Runway Analysis
With ${funding:,.0f} in total funding and a monthly burn of ${burn:,.0f}, the runway stands at **{runway:.1f} months**. {'This is a critical situation — fundraising must begin immediately.' if runway < 6 else 'The team should begin Series conversations within 3 months.' if runway < 12 else 'The runway is healthy but efficiency improvements are recommended.'}

## Strategic Recommendations
1. **Reduce burn rate** by 20-30% to extend runway and reduce pressure on fundraising timelines
2. **Focus on paying customer acquisition** — current count of {raw_input.get('payingCustomers', 0)} is insufficient for Series A readiness
3. **Address churn** before scaling acquisition spend — fix the leaky bucket first
4. **Document traction metrics** rigorously for the next fundraising round

## Verdict
{name} is {'not currently investment-ready without significant operational changes' if risk_score > 60 else 'approaching investment readiness with focused execution on the flagged areas' if risk_score > 40 else 'showing a relatively healthy profile with manageable risks'}. The {risk_label.lower()} classification is driven primarily by {shap_breakdown[0]['factor'].lower() if shap_breakdown else 'financial metrics'}. Addressing the top 2 strategic recommendations would materially improve the risk profile within 60-90 days."""

# ─────────────────────────────────────────────
#  MAIN ENDPOINT
# ─────────────────────────────────────────────
@app.route('/analyze', methods=['POST'])
def analyze():
    raw = request.json

    # Feature engineering
    features = engineer_features(raw)
    row = pd.DataFrame([features])[FEATURE_COLS]
    row_scaled = scaler.transform(row)

    # Predictions from all 3 models
    xgb_prob = xgb_model.predict_proba(row_scaled)[0][1]
    rf_prob = rf_model.predict_proba(row_scaled)[0][1]
    lr_prob = lr_model.predict_proba(row_scaled)[0][1]

    # Weighted ensemble (XGB gets most weight)
    ensemble_prob = (xgb_prob * 0.6 + rf_prob * 0.3 + lr_prob * 0.1)
    risk_score = round(ensemble_prob * 100, 1)
    risk_label = "High Risk" if ensemble_prob > 0.5 else "Low Risk"
    risk_level = "high" if ensemble_prob > 0.65 else "medium" if ensemble_prob > 0.35 else "low"

    # SHAP breakdown
    shap_breakdown = get_shap_breakdown(features)

    # Dimension scores
    dimensions = compute_dimension_scores(features)

    # LLM Report
    report = generate_llm_report(raw, risk_score, risk_label, dimensions, shap_breakdown)

    # Model agreement
    model_scores = {
        'XGBoost': round(xgb_prob * 100, 1),
        'Random Forest': round(rf_prob * 100, 1),
        'Logistic Regression': round(lr_prob * 100, 1)
    }

    return jsonify({
        'riskScore': risk_score,
        'riskLabel': risk_label,
        'riskLevel': risk_level,
        'ensembleProb': round(ensemble_prob, 4),
        'modelScores': model_scores,
        'dimensions': dimensions,
        'shapBreakdown': shap_breakdown,
        'report': report,
        'runway': round(features['runway'], 1),
        'efficiency': round(features['efficiency'] * 100, 2)
    })

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'models': ['XGBoost', 'RandomForest', 'LogisticRegression']})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
