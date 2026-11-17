import React, { useState } from 'react';
import { Check, Copy, Download } from 'lucide-react';

const PYTHON_APP_CODE = `"""
IPL QuantLab — Python Data Science & Autonomous AI Analytics Project
Run in VS Code:
  pip install -r requirements.txt
  export GEMINI_API_KEY="your_api_key_here"
  streamlit run ipl_analytics.py
"""
import json
import os
import base64
import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.linear_model import LinearRegression
import streamlit as st
from google import genai

st.set_page_config(page_title="IPL QuantLab | Data Science Analytics", layout="wide")

TEAM_ORDER = ["MI", "CSK", "RCB", "GT", "DC", "RR", "LSG", "SRH", "PBKS", "KKR"]

DEFAULT_TEAMS = {
    "MI": {"name": "Mumbai Indians", "captain": "Hardik Pandya", "color": "#004BA0"},
    "CSK": {"name": "Chennai Super Kings", "captain": "Ruturaj Gaikwad", "color": "#CA8A04"},
    "RCB": {"name": "Royal Challengers Bengaluru", "captain": "Rajat Patidar", "color": "#DC2626"},
    "GT": {"name": "Gujarat Titans", "captain": "Shubman Gill", "color": "#1E3A5F"},
    "DC": {"name": "Delhi Capitals", "captain": "Axar Patel", "color": "#1D4ED8"},
    "RR": {"name": "Rajasthan Royals", "captain": "Sanju Samson", "color": "#DB2777"},
    "LSG": {"name": "Lucknow Super Giants", "captain": "Rishabh Pant", "color": "#0284C7"},
    "SRH": {"name": "Sunrisers Hyderabad", "captain": "Pat Cummins", "color": "#EA580C"},
    "PBKS": {"name": "Punjab Kings", "captain": "Shreyas Iyer", "color": "#B91C1C"},
    "KKR": {"name": "Kolkata Knight Riders", "captain": "Ajinkya Rahane", "color": "#581C87"},
}

DEFAULT_PLAYERS = [
    {"name": "Hardik Pandya", "team": "MI", "category": "All-Rounder", "runs": 2525, "balls_faced": 1732, "dot_balls_faced": 540, "strike_rate": 145.79, "bat_avg": 28.69, "fours": 190, "sixes": 136, "wickets": 64, "overs": 286.4, "runs_conceded": 2594, "dot_balls_bowled": 582, "economy": 9.05, "bowl_sr": 26.8, "photo": ""},
    {"name": "Rohit Sharma", "team": "MI", "category": "Batsman", "runs": 6628, "balls_faced": 5054, "dot_balls_faced": 1915, "strike_rate": 131.14, "bat_avg": 29.72, "fours": 599, "sixes": 280, "wickets": 0, "overs": 0, "runs_conceded": 0, "dot_balls_bowled": 0, "economy": 0, "bowl_sr": 0, "photo": ""},
    {"name": "Jasprit Bumrah", "team": "MI", "category": "Bowler", "runs": 0, "balls_faced": 0, "dot_balls_faced": 0, "strike_rate": 0, "bat_avg": 0, "fours": 0, "sixes": 0, "wickets": 165, "overs": 508.2, "runs_conceded": 3711, "dot_balls_bowled": 1295, "economy": 7.30, "bowl_sr": 18.48, "photo": ""},
    {"name": "Ruturaj Gaikwad", "team": "CSK", "category": "Batsman", "runs": 2380, "balls_faced": 1739, "dot_balls_faced": 590, "strike_rate": 136.86, "bat_avg": 41.75, "fours": 215, "sixes": 91, "wickets": 0, "overs": 0, "runs_conceded": 0, "dot_balls_bowled": 0, "economy": 0, "bowl_sr": 0, "photo": ""},
    {"name": "Ravindra Jadeja", "team": "CSK", "category": "All-Rounder", "runs": 2959, "balls_faced": 2281, "dot_balls_faced": 775, "strike_rate": 129.72, "bat_avg": 27.40, "fours": 214, "sixes": 107, "wickets": 160, "overs": 659.1, "runs_conceded": 5016, "dot_balls_bowled": 1465, "economy": 7.61, "bowl_sr": 24.7, "photo": ""},
    {"name": "Virat Kohli", "team": "RCB", "category": "Batsman", "runs": 8004, "balls_faced": 6065, "dot_balls_faced": 2040, "strike_rate": 131.97, "bat_avg": 38.67, "fours": 705, "sixes": 272, "wickets": 0, "overs": 0, "runs_conceded": 0, "dot_balls_bowled": 0, "economy": 0, "bowl_sr": 0, "photo": ""},
    {"name": "Shubman Gill", "team": "GT", "category": "Batsman", "runs": 3216, "balls_faced": 2369, "dot_balls_faced": 812, "strike_rate": 135.75, "bat_avg": 37.84, "fours": 310, "sixes": 95, "wickets": 0, "overs": 0, "runs_conceded": 0, "dot_balls_bowled": 0, "economy": 0, "bowl_sr": 0, "photo": ""},
    {"name": "Rashid Khan", "team": "GT", "category": "All-Rounder", "runs": 545, "balls_faced": 328, "dot_balls_faced": 108, "strike_rate": 166.16, "bat_avg": 15.14, "fours": 40, "sixes": 39, "wickets": 149, "overs": 472.2, "runs_conceded": 3221, "dot_balls_bowled": 1185, "economy": 6.82, "bowl_sr": 19.02, "photo": ""},
    {"name": "Axar Patel", "team": "DC", "category": "All-Rounder", "runs": 1653, "balls_faced": 1263, "dot_balls_faced": 422, "strike_rate": 130.88, "bat_avg": 21.47, "fours": 114, "sixes": 79, "wickets": 123, "overs": 516.3, "runs_conceded": 3759, "dot_balls_bowled": 1190, "economy": 7.28, "bowl_sr": 25.2, "photo": ""},
    {"name": "Sanju Samson", "team": "RR", "category": "Batsman", "runs": 4419, "balls_faced": 3180, "dot_balls_faced": 1090, "strike_rate": 138.96, "bat_avg": 30.69, "fours": 352, "sixes": 206, "wickets": 0, "overs": 0, "runs_conceded": 0, "dot_balls_bowled": 0, "economy": 0, "bowl_sr": 0, "photo": ""},
    {"name": "Rishabh Pant", "team": "LSG", "category": "Batsman", "runs": 3284, "balls_faced": 2205, "dot_balls_faced": 684, "strike_rate": 148.93, "bat_avg": 35.31, "fours": 296, "sixes": 154, "wickets": 0, "overs": 0, "runs_conceded": 0, "dot_balls_bowled": 0, "economy": 0, "bowl_sr": 0, "photo": ""},
    {"name": "Pat Cummins", "team": "SRH", "category": "All-Rounder", "runs": 515, "balls_faced": 347, "dot_balls_faced": 120, "strike_rate": 148.41, "bat_avg": 19.07, "fours": 36, "sixes": 34, "wickets": 63, "overs": 219.1, "runs_conceded": 1918, "dot_balls_bowled": 512, "economy": 8.75, "bowl_sr": 20.87, "photo": ""},
    {"name": "Shreyas Iyer", "team": "PBKS", "category": "Batsman", "runs": 3127, "balls_faced": 2453, "dot_balls_faced": 845, "strike_rate": 127.48, "bat_avg": 32.24, "fours": 271, "sixes": 113, "wickets": 0, "overs": 0, "runs_conceded": 0, "dot_balls_bowled": 0, "economy": 0, "bowl_sr": 0, "photo": ""},
    {"name": "Sunil Narine", "team": "KKR", "category": "All-Rounder", "runs": 1534, "balls_faced": 925, "dot_balls_faced": 318, "strike_rate": 165.84, "bat_avg": 16.67, "fours": 162, "sixes": 96, "wickets": 180, "overs": 686.1, "runs_conceded": 4618, "dot_balls_bowled": 1720, "economy": 6.73, "bowl_sr": 22.87, "photo": ""},
]

if "teams" not in st.session_state:
    st.session_state.teams = DEFAULT_TEAMS
if "players" not in st.session_state:
    st.session_state.players = pd.DataFrame(DEFAULT_PLAYERS)

def compute_data_science_metrics(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["dot_pct_bat"] = np.where(out["balls_faced"] > 0, (out["dot_balls_faced"] / out["balls_faced"]) * 100, 0.0)
    out["boundary_pct"] = np.where(out["balls_faced"] > 0, ((out["fours"] + out["sixes"]) / out["balls_faced"]) * 100, 0.0)
    bowl_balls = np.floor(out["overs"]) * 6 + ((out["overs"] - np.floor(out["overs"])) * 10).round()
    out["dot_pct_bowl"] = np.where(bowl_balls > 0, (out["dot_balls_bowled"] / bowl_balls) * 100, 0.0)

    # Z-Score Standardization for Composite Impact
    bat_mask = out["balls_faced"] > 0
    bowl_mask = out["overs"] > 0

    out["bat_impact"] = 0.0
    if bat_mask.sum() > 1:
        scaler = StandardScaler()
        z_bat = scaler.fit_transform(out.loc[bat_mask, ["strike_rate", "bat_avg", "dot_pct_bat"]])
        raw_bat = 55 + (0.45 * z_bat[:, 0] + 0.35 * z_bat[:, 1] - 0.20 * z_bat[:, 2]) * 15
        out.loc[bat_mask, "bat_impact"] = np.clip(raw_bat, 15, 99).round(1)

    out["bowl_impact"] = 0.0
    if bowl_mask.sum() > 1:
        scaler = StandardScaler()
        z_bowl = scaler.fit_transform(out.loc[bowl_mask, ["economy", "bowl_sr", "dot_pct_bowl"]])
        raw_bowl = 55 + (-0.45 * z_bowl[:, 0] - 0.35 * z_bowl[:, 1] + 0.20 * z_bowl[:, 2]) * 15
        out.loc[bowl_mask, "bowl_impact"] = np.clip(raw_bowl, 15, 99).round(1)

    out["impact_score"] = np.where(
        out["category"] == "Batsman", out["bat_impact"],
        np.where(out["category"] == "Bowler", out["bowl_impact"],
                 np.clip(0.5 * out["bat_impact"] + 0.5 * out["bowl_impact"] + 5, 20, 99))
    ).round(1)

    # KMeans Archetype Clustering
    if len(out) >= 4:
        features = out[["bat_impact", "bowl_impact", "dot_pct_bat", "dot_pct_bowl"]].fillna(0)
        km = KMeans(n_clusters=4, random_state=42, n_init=10)
        out["cluster_id"] = km.fit_predict(StandardScaler().fit_transform(features))
    else:
        out["cluster_id"] = 0
    return out

def ai_auto_sync_ipl_data():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        st.error("Set GEMINI_API_KEY environment variable to run autonomous AI sync.")
        return
    client = genai.Client(api_key=api_key)
    prompt = f"""Use Google Search to update IPL captains and T20 stats for these players:
    {st.session_state.players[['name', 'team', 'category', 'runs', 'wickets']].to_dict(orient='records')}
    Return ONLY JSON: {{"captains": {{"MI": "..."}}, "players": [{{"name": "...", "runs": 0, "strike_rate": 0, "wickets": 0, "economy": 0}}]}}"""
    resp = client.models.generate_content(
        model="gemini-4-hydrogen",
        contents=prompt,
        config={"tools": [{"google_search": {}}]},
    )
    payload = json.loads(resp.text.strip().strip("\`\`\`json").strip("\`\`\`"))
    for code, cap in payload.get("captains", {}).items():
        if code in st.session_state.teams:
            st.session_state.teams[code]["captain"] = cap
    df = st.session_state.players
    for upd in payload.get("players", []):
        mask = df["name"] == upd.get("name")
        for col in ["runs", "strike_rate", "wickets", "economy"]:
            if col in upd:
                df.loc[mask, col] = upd[col]
    st.session_state.players = df
    st.success("Autonomous AI sync completed with live search grounding.")

st.title("IPL QuantLab — Python Data Science Analytics")

# Ordered Top Team Selector: MI -> CSK -> RCB -> GT -> DC -> RR -> LSG -> SRH -> PBKS -> KKR
selected_team = st.radio(
    "Select Franchise (Ordered MI to KKR)",
    ["ALL"] + TEAM_ORDER,
    horizontal=True,
)

col_ai, col_cap = st.columns([1, 2])
with col_ai:
    if st.button("Auto-Sync Latest IPL Data via AI", type="primary"):
        ai_auto_sync_ipl_data()

if selected_team != "ALL":
    t_info = st.session_state.teams[selected_team]
    with col_cap:
        new_cap = st.text_input(f"{t_info['name']} Captain", value=t_info["captain"])
        st.session_state.teams[selected_team]["captain"] = new_cap

df_metrics = compute_data_science_metrics(st.session_state.players)
view_df = df_metrics if selected_team == "ALL" else df_metrics[df_metrics["team"] == selected_team]

# Add Player Form with Category & Photo Upload
with st.expander("Add Player (Select Batsman / Bowler / All-Rounder & Upload Photo)"):
    cat = st.selectbox("Category", ["Batsman", "Bowler", "All-Rounder"])
    with st.form("add_player_form"):
        p_name = st.text_input("Player Name")
        p_team = st.selectbox("Team", TEAM_ORDER, index=0 if selected_team == "ALL" else TEAM_ORDER.index(selected_team))
        p_photo = st.file_uploader("Upload Player Photo", type=["png", "jpg", "jpeg"])
        c1, c2, c3, c4 = st.columns(4)
        runs = c1.number_input("Total Runs", 0) if cat in ["Batsman", "All-Rounder"] else 0
        balls = c2.number_input("Balls Faced", 0) if cat in ["Batsman", "All-Rounder"] else 0
        dots_bat = c3.number_input("Dot Balls Faced", 0) if cat in ["Batsman", "All-Rounder"] else 0
        sr = c4.number_input("Strike Rate", 0.0) if cat in ["Batsman", "All-Rounder"] else 0.0

        b1, b2, b3, b4 = st.columns(4)
        wkts = b1.number_input("Wickets", 0) if cat in ["Bowler", "All-Rounder"] else 0
        overs = b2.number_input("Overs Bowled", 0.0) if cat in ["Bowler", "All-Rounder"] else 0.0
        econ = b3.number_input("Economy Rate", 0.0) if cat in ["Bowler", "All-Rounder"] else 0.0
        dots_bowl = b4.number_input("Dot Balls Bowled", 0) if cat in ["Bowler", "All-Rounder"] else 0

        if st.form_submit_button("Add Player"):
            photo_b64 = ""
            if p_photo is not None:
                photo_b64 = f"data:image/jpeg;base64,{base64.b64encode(p_photo.getvalue()).decode()}"
            new_row = {
                "name": p_name, "team": p_team, "category": cat, "runs": runs,
                "balls_faced": balls, "dot_balls_faced": dots_bat, "strike_rate": sr,
                "bat_avg": round(runs / 10, 2), "fours": 0, "sixes": 0,
                "wickets": wkts, "overs": overs, "runs_conceded": 0,
                "dot_balls_bowled": dots_bowl, "economy": econ, "bowl_sr": 20.0, "photo": photo_b64
            }
            st.session_state.players = pd.concat([pd.DataFrame([new_row]), st.session_state.players], ignore_index=True)
            st.rerun()

st.subheader("Player Performance & Data Science Metrics")
st.dataframe(view_df, use_container_width=True)

# OLS Linear Regression + Plotly Interactive Chart
bat_df = view_df[view_df["balls_faced"] > 0]
if len(bat_df) >= 2:
    reg = LinearRegression().fit(bat_df[["dot_pct_bat"]], bat_df["strike_rate"])
    fig = px.scatter(
        bat_df, x="dot_pct_bat", y="strike_rate", size="impact_score", color="team",
        hover_name="name", title="OLS Regression: Dot Ball % vs Batting Strike Rate"
    )
    x_line = np.linspace(bat_df["dot_pct_bat"].min(), bat_df["dot_pct_bat"].max(), 50)
    fig.add_trace(go.Scatter(x=x_line, y=reg.predict(x_line.reshape(-1, 1)), mode="lines", name="OLS Fit"))
    st.plotly_chart(fig, use_container_width=True)
`;

const PYTHON_REQS = `streamlit>=1.39.0
pandas>=2.2.0
numpy>=1.26.0
scikit-learn>=1.5.0
plotly>=5.24.0
google-genai>=1.0.0
`;

const VSCODE_COMMANDS = `# 1. Create folder & open in VS Code
mkdir ipl-quantlab && cd ipl-quantlab
code .

# 2. Install Node.js Full-Stack dependencies
npm install express dotenv @google/genai lucide-react
npm install -D vite @vitejs/plugin-react tailwindcss @tailwindcss/vite tsx typescript @types/express @types/node

# 3. Configure .env in project root
GEMINI_API_KEY="your_gemini_api_key"
PORT=3000

# 4. Run full-stack React + Express + Gemini AI Server
npm run dev

# --- API Endpoints Available Automatically ---
# GET  /api/data            -> Ordered teams (MI -> KKR), captains, players
# POST /api/players         -> Add Batsman / Bowler / All-Rounder + photo
# PUT  /api/players/:id     -> Edit player photo or live IPL stats
# PUT  /api/teams/:code     -> Update franchise captain
# POST /api/ai/sync         -> Autonomous Gemini + Google Search stat refresh
# POST /api/ai/scout-player -> AI auto-fills stats for any newly added player`;

export const CodeExportView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'python' | 'vscode'>('python');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownload = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-display font-bold text-slate-900">
              VS Code &amp; Python Project Export
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Copy-paste ready Python Data Science (Streamlit + Pandas + Scikit-Learn + Plotly + Gemini) and VS Code Node/React setup.
            </p>
          </div>
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
            <button
              type="button"
              onClick={() => setActiveTab('python')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'python'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Python Data Science (Streamlit)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('vscode')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'vscode'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              VS Code Full-Stack (TS + React)
            </button>
          </div>
        </div>

        {activeTab === 'python' ? (
          <div className="space-y-6 mt-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono font-semibold text-slate-800">
                  requirements.txt
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopy('reqs', PYTHON_REQS)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer"
                  >
                    {copiedId === 'reqs' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedId === 'reqs' ? 'Copied' : 'Copy'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownload('requirements.txt', PYTHON_REQS)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </button>
                </div>
              </div>
              <pre className="p-4 rounded-lg bg-slate-950 text-slate-100 text-xs font-mono overflow-x-auto leading-relaxed">
                {PYTHON_REQS}
              </pre>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono font-semibold text-slate-800">
                  ipl_analytics.py
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopy('py', PYTHON_APP_CODE)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer"
                  >
                    {copiedId === 'py' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedId === 'py' ? 'Copied' : 'Copy Code'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownload('ipl_analytics.py', PYTHON_APP_CODE)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-medium text-white cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download .py
                  </button>
                </div>
              </div>
              <pre className="p-4 rounded-lg bg-slate-950 text-slate-100 text-xs font-mono overflow-x-auto max-h-[520px] leading-relaxed">
                {PYTHON_APP_CODE}
              </pre>
            </div>
          </div>
        ) : (
          <div className="space-y-4 mt-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-semibold text-slate-800">
                VS Code Terminal Setup &amp; API Reference
              </span>
              <button
                type="button"
                onClick={() => handleCopy('vscode', VSCODE_COMMANDS)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer"
              >
                {copiedId === 'vscode' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedId === 'vscode' ? 'Copied' : 'Copy Setup'}
              </button>
            </div>
            <pre className="p-4 rounded-lg bg-slate-950 text-slate-100 text-xs font-mono overflow-x-auto leading-relaxed">
              {VSCODE_COMMANDS}
            </pre>
            <p className="text-xs text-slate-600 leading-relaxed">
              Every file in this running workspace (<code className="font-mono text-slate-900">server.ts</code>, <code className="font-mono text-slate-900">src/utils/analytics.ts</code>, <code className="font-mono text-slate-900">src/components/*</code>, <code className="font-mono text-slate-900">src/App.tsx</code>) is TypeScript-strict and ready to run directly in VS Code with <code className="font-mono text-slate-900">npm run dev</code>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
