# Startup Risk Analyser

A machine learning application that evaluates startup viability across financial, team, traction, and market dimensions — producing a risk score, SHAP-attributed factor breakdown, and a full analyst report.

---

## What It Does

Enter a startup's key metrics. Three ML models run in parallel, a weighted ensemble produces a 0–100 risk score, SHAP attribution explains which factors drove the result, and an LLM compiles everything into a structured analyst report.

**Input → ML Pipeline → Risk Score + Report**

---

## Demo

| Form | Results | Report |
|---|---|---|
| Structured 4-section intake | Radar chart + SHAP bar chart | Full analyst report with recommendations |

> Built with a warm editorial aesthetic — no dark dashboard clichés.

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | React + Recharts | Dynamic charts, component-based report rendering |
| Backend | Python + Flask | ML pipeline, feature engineering, SHAP |
| Primary model | Gradient Boosting | Best tabular accuracy, native SHAP support |
| Secondary model | Random Forest | Handles non-linear interactions, reduces variance |
| Baseline | Logistic Regression | Calibrated probabilities, interpretability check |
| Explainability | SHAP TreeExplainer | Per-prediction factor attribution |
| Data | Pandas + NumPy | Feature engineering, normalisation |
| Report generation | Claude API (Anthropic) | Natural language analyst report |

---

## ML Architecture

```
User Input (12 fields)
       │
       ▼
Feature Engineering
  ├─ runway = funding / burn_rate
  ├─ efficiency = revenue / funding
  └─ stage_encoded, derived signals
       │
       ▼
MinMaxScaler (normalisation)
       │
       ├──► Gradient Boosting  ──► prob × 0.6 ─┐
       ├──► Random Forest      ──► prob × 0.3 ──┼──► Ensemble Risk Score
       └──► Logistic Regression ─► prob × 0.1 ─┘
                                                │
                                                ▼
                                        SHAP TreeExplainer
                                        (factor attribution)
                                                │
                                                ▼
                                        Dimension Scoring
                                   (Financial / Team / Traction / Market)
                                                │
                                                ▼
                                        LLM Report Generation
```

### Ensemble Weights

| Model | Weight | Rationale |
|---|---|---|
| Gradient Boosting | 60% | Highest AUC on holdout set |
| Random Forest | 30% | Diversity — different decision boundaries |
| Logistic Regression | 10% | Calibration anchor |

---

## Risk Dimensions

The app scores four dimensions independently (0–100, higher = healthier):

- **Financial Health** — runway, capital efficiency, revenue growth
- **Team Strength** — prior exits, domain experience, team size
- **Traction** — paying customers, churn rate
- **Market Position** — TAM size, pivot count

---

## Features

- **Three-model ensemble** with weighted voting
- **SHAP explainability** — every score is explained factor by factor
- **Dimension radar chart** — visual breakdown of health across 4 axes
- **SHAP bar chart** — ranked factor attribution with direction (risk-increasing vs risk-reducing)
- **LLM analyst report** — executive summary, strengths, risks, recommendations, verdict
- **Fallback report** — rule-based report generates even without an API key
- **Animated loading sequence** — shows each ML step as it runs

---

## Project Structure

```
startup-risk-analyser/
├── backend/
│   ├── app.py                  # Flask API — ML pipeline, SHAP, report generation
│   └── requirements.txt        # Python dependencies
├── frontend/
│   └── src/
│       └── App.jsx             # React app — form, charts, report display
├── notebooks/
│   └── eda_and_modelling.ipynb # EDA, model comparison, SHAP analysis
└── README.md
```

---

## Running Locally

### Prerequisites

- Python 3.10+
- Node.js 18+

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Optionally set your Anthropic API key for AI-generated reports:

```bash
export ANTHROPIC_API_KEY=your_key_here
```

Start the server:

```bash
python app.py
```

Server runs on `http://localhost:5000`. You should see:

```
🔧 Training models on synthetic data...
✅ Models trained and ready.
* Running on http://127.0.0.1:5000
```

### Frontend

In a new terminal:

```bash
cd frontend
npm install
npm install recharts
npm start
```

App opens at `http://localhost:3000`.

---

## Example Inputs

**High Risk startup:**
| Field | Value |
|---|---|
| Funding | $200,000 |
| Burn Rate | $50,000/mo |
| Revenue | $3,000/mo |
| Churn | 20% |
| Paying Customers | 5 |
| Runway | 4 months |

**Low Risk startup:**
| Field | Value |
|---|---|
| Funding | $2,000,000 |
| Burn Rate | $40,000/mo |
| Revenue | $80,000/mo |
| Churn | 3% |
| Paying Customers | 150 |
| Runway | 50 months |

---

## Data & Training

The model is trained on **1,000 synthetic startups** generated with domain-informed risk heuristics. Risk labels are derived from combinations of financial signals known to predict startup failure — not random assignment:

- Runway < 6 months → strong risk signal
- Paying customers < 10 → high risk contribution
- Churn > 15% → significant risk factor
- Capital efficiency < 5% → risk indicator
- Prior founder exits → risk reducer

This approach follows the methodology used in academic startup survival research (Gompers et al., Åstebro & Bernhardt) where financial runway and traction metrics are the dominant predictors.

See [`notebooks/eda_and_modelling.ipynb`](notebooks/eda_and_modelling.ipynb) for the full EDA, model comparison, ROC curves, confusion matrices, and SHAP analysis.

---

## API Reference

### `POST /analyze`

**Request body:**

```json
{
  "startupName": "Meridian Labs",
  "industry": "SaaS",
  "stage": "seed",
  "funding": 1500000,
  "burnRate": 35000,
  "revenue": 22000,
  "revenueGrowth": 18,
  "churnRate": 4,
  "teamSize": 7,
  "priorExits": "yes",
  "domainExp": 8,
  "monthsSinceLaunch": 14,
  "payingCustomers": 95,
  "tam": "large",
  "pivotCount": "0"
}
```

**Response:**

```json
{
  "riskScore": 34.2,
  "riskLabel": "Low Risk",
  "riskLevel": "low",
  "modelScores": {
    "XGBoost": 31.4,
    "Random Forest": 38.9,
    "Logistic Regression": 29.1
  },
  "dimensions": {
    "Financial Health": 78,
    "Team Strength": 85,
    "Traction": 72,
    "Market Position": 90
  },
  "shapBreakdown": [...],
  "report": "## Executive Summary\n...",
  "runway": 42.8,
  "efficiency": 1.47
}
```

### `GET /health`

Returns model status.

---

## Notebook

[`notebooks/eda_and_modelling.ipynb`](notebooks/eda_and_modelling.ipynb) covers:

1. Dataset generation and class balance analysis
2. Feature distributions by risk class
3. Correlation heatmap
4. Runway vs churn scatter analysis
5. Model training and ROC curve comparison
6. Confusion matrices for all three models
7. SHAP global importance (bar + beeswarm)
8. SHAP waterfall for individual predictions
9. Ensemble vs individual model performance

---

## Limitations

- Trained on synthetic data — predictions should be treated as directional signals, not investment advice
- 15 input features cover the most predictive signals but cannot capture all startup dynamics
- LLM report quality depends on Anthropic API availability; fallback report activates automatically

---

## License

MIT