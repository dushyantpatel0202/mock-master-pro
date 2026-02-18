# MockMaster Pro

A mock test simulator with:
- Frontend: `index.html` + `script.js`
- Backend: Node.js + Express + MongoDB in `mock-backend/`

## Features
- Loads questions from backend API (`/api/questions`)
- Fallback to local JSON when API is unavailable
- Test timer, navigation palette, review marking, and score summary
- Saves results to MongoDB

## Project Structure

- `index.html` - UI
- `script.js` - frontend logic
- `mock-backend/server.js` - API server
- `mock-backend/questions.json` - seed/fallback question data

## Prerequisites
- Node.js 18+
- MongoDB running locally (`mongodb://localhost:27017`)

## Backend Setup

```bash
cd mock-backend
npm install
npm start
```

Server runs at: `http://localhost:3000`

## Seed Questions to MongoDB

With backend running:

```bash
cd mock-backend
npm run seed
```

## Run Frontend

Open `index.html` using Live Server or any static server.

## Data Source Logic
Frontend attempts sources in this order:
1. `http://localhost:3000/api/questions` (MongoDB via backend)
2. `mock-backend/questions.json`
3. `questions.json` (legacy fallback)

## Environment Variable (Optional)

Create a `.env` in `mock-backend/` if needed:

```env
MONGO_URI=mongodb://localhost:27017/mockmaster
PORT=3000
```

## Author
- dushyantpatel0202
