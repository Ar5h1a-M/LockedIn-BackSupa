# LockedIn Backend


[![Tests](https://github.com/Ar5h1a-M/LockedIn-BackSupa/actions/workflows/test.yml/badge.svg)](https://github.com/Ar5h1a-M/LockedIn-BackSupa/actions)
[![codecov](https://codecov.io/github/Ar5h1a-M/LockedIn-BackSupa/branch/Dev%2FS3/graph/badge.svg?token=XS629RI4DA)](https://codecov.io/github/Ar5h1a-M/LockedIn-BackSupa)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-green.svg)](https://nodejs.org/)

## Quick Stats
![Lines of Code](https://img.shields.io/tokei/lines/github/Ar5h1a-M/LockedIn-BackSupa)
![Last Commit](https://img.shields.io/github/last-commit/Ar5h1a-M/LockedIn-BackSupa)



This is the backend API for **LockedIn**, a study buddy app that helps students find partners, create groups, and track progress.  
It handles authentication (via Supabase Auth + Google OAuth) and user profile management.

- **Framework**: Node.js + Express  
- **Database & Auth**: Supabase (Postgres + Auth)  .
- **Deployment**: Render  

---

## 📂 Repo Structure
├── src/
│   ├── routes/
│   │   └── auth.js         # Login & Signup routes
│   ├── utils/
│   │   ├── db.js           # (optional DB helpers)
│   │   └── supabaseClient.js # Supabase client config
│   └── server.js           # Express server entry
├── .env                    # Local env vars
├── package.json
└── README.md

## 🚀 Quick Start
1. Clone the repo:
   ```bash
   git clone https://github.com/Ar5h1a-M/LockedIn-BackSupa.git
   cd LockedIn-BackSupa
   npm install

2. Add an .env file with your Supabase keys
	SUPABASE_URL=https://obglzwqlngggkelvstfa.supabase.co

	SUPABASE_SERVICE_ROLE_KEY=eyJh………

	PORT=4000
3. Start the dev server:
   ```bash
	npm start
4. verify its running
	go to :http://localhost:4000/


POST /api/auth/signup

	Requires: Authorization: Bearer <supabase_access_token>

	If user does not exist in profiles, creates a profile row.

	If user already exists → 400 User already exists.

POST /api/auth/login

	Requires: Authorization: Bearer <supabase_access_token>

	Checks if user exists in profiles.

	If not → deletes auth user & returns 401 User not found.

	If yes → returns success + user info.







	


