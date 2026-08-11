# CanePulse Analytics

Act as an expert Senior Full-Stack Engineer and UX/UI Designer. Build a highly professional, enterprise-grade web application named "CanePulse" for sugarcane logistics and milling optimization. The UI must be modern, clean, dark-mode preferred (or sophisticated light/green corporate theme), ultra-scalable, using Tailwind CSS and Lucide Icons.

### 🌟 TOP HEADER (CanePulse Panel)

- At the very top of the app, create a discreet, sleek top bar named "CanePulse".

- Right next to the app name, display a subtle badge with the text: "Logged: Diogo Mendes".

### 🏗️ DATA STRUCTURE & ARCHITECTURE

- Support up to 7 Industrial Units (Usinas).

- Each Unit can have up to 8 Work Fronts (Frentes de Trabalho).

---

### 🟢 STEP 1: INITIAL SETUP CARDS (Data Input)

Create a dynamic setup dashboard where the user can fill in the baseline data for each Unit:

1. **Nome da Unidade** (Text Input)

2. **Meta de Moagem Diária da Unidade (toneladas)** (Number Input)

3. **Densidade de Carga da Unidade (t/m³ or t/trip)** (Number Input)

4. **Meta Global do Grupo (Soma Automática)**: A card showing the automated sum of all Units' daily milling targets.

---

### 🔵 STEP 2: OPERATIONAL FEEDING & VISION AI MAPPING

For each created Unit, create two sections:

#### A) Work Fronts Management (Frentes de Trabalho)

- A prominent button: "+ Adicionar Frente de Trabalho".

- When clicked, it opens inline inputs or a modal to enter:

  - **Número da Frente** (e.g., 86, 91, 9002)

  - **Potencial da Frente** (Target hourly delivery in number of trucks/conjuntos per hour).

- Render this instantly as a clean data table inside the Unit’s section.

#### B) Screenshot/Image Spreadsheet Intake (Vision/OCR Engine)

- Each Unit MUST have its own designated File/Image Upload area.

- This area accepts a screenshot of the hourly logistics spreadsheet (Matrix of Hours vs. Fronts, showing the number of trucks dispatched per hour).

- **CRITICAL LOGIC**: Embed or simulate an AI Vision/OCR workflow. The system must parse the uploaded image, extract the data, and match the Front Numbers found in the image with the Front Numbers manually created in Step 2A.

- **Rule**: If a Front Number exists in the screenshot but was NOT created in the manual table, **IGNORE IT**. Only calculate and aggregate data for the manually registered Fronts.

---

### 🟡 STEP 3: ANALYTICAL ENGINE & DASHBOARDS (The Calculations)

Once Steps 1 and 2 are filled/uploaded, render a comprehensive Analytical Dashboard with the following metrics and behaviors:

#### 1. Individual Front Performance (Potencial vs Real)

- Compare the registered Hourly Potential against the Real Dispatches extracted from the spreadsheet.

- **If Real < Potential**: Display a prominent warning style and dynamically generate a **Justificativa (Justification)** text field so the user can input the reason for the deficit (e.g., weather, maintenance, no operator).

#### 2. Unit Potential vs Real Delivery (Period Analysis)

- Calculate the total Potential vs Real delivery of all combined fronts within the active timeframe filled/uploaded (e.g., if the spreadsheet covers 4 hours, evaluate a 4-hour window).

#### 3. Daily Closing Impact: Potential Fronts vs Milling Target

- Project the impact if all fronts worked at full **Potential** for 24 hours vs the original Unit Milling Target.

#### 4. Daily Closing Impact: Real Delivery vs Milling Target

- Project the actual deficit or surplus at the end of the day based on the **Real** current hourly delivery trend vs the original Unit Milling Target.

#### 5. Real Hourly Milling Rate

- Display the actual Tonnes per Hour (t/h) being delivered right now.

- **Formula**: `Total trucks dispatched in the active hours` × `Unit Load Density` ÷ `Number of active hours tracked`.

#### 6. End-of-Day Estimated Milling Projection

- Project the total tonnage at Hour 24 based on the Real Hourly Rate calculated above.

---

### 📄 STEP 4: ADVANCED REPORTING TABS

Create a dedicated reporting area with beautiful typography, clean spacing, visual anchors, and export icons.

#### Tab A: "Relatório de Fechamento de Hora" (Hourly Performance Report)

- Textual, detailed, and highly visual report.

- Tracks performance from the very first hour recorded in the spreadsheet up to the latest timestamp.

- **Filters**: Must include interactive filters to toggle between view by "Unidade Individual" or combined "Grupo".

#### Tab B: "Relatório Final do Dia (24h)" (Daily Summary Report)

- A comprehensive executive summary reflecting the consolidated 24-hour cycle.

- Uses icons (green checkmarks for compliance, amber for risks, red for critical deficits) to summarize the final balance of mass, total lost tonnage, and main bottlenecks compiled from the front justifications.

Ensure state management is reactive, clean, and validations prevent division by zero when metrics are empty. Build this as a robust, production-ready interface.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://pulse-logistics-pro.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/18a3a5db-c97f-4708-9922-05d0f3975687).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
