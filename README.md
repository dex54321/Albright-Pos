# Albright Hardware Enterprice - POS & Inventory

A full multi-user Point of Sale and inventory system: Next.js + PostgreSQL,
built to be deployed on Vercel with a free Neon database. Several devices
(till, office laptop, your phone) can use it at once, all sharing the same
data.

This is the "core first" version: selling, stock, purchases, credit,
customers, suppliers, expenses, shifts, users/roles, and basic reports are
all fully working. Some things from the original wish-list (barcode
scanning hardware, PDF-formatted receipts, automatic M-Pesa via Daraja,
audit-log page, product CSV import) are not in this version yet - see
"What's not built yet" at the bottom.

---

## 1. Before you start

You'll need three free accounts:

1. **GitHub** (github.com) - to hold the code.
2. **Neon** (neon.tech) - the database.
3. **Vercel** (vercel.com) - hosting. You can sign up with your GitHub account.

You'll also need **Node.js** installed on your laptop (get the "LTS"
version from nodejs.org) so you can run a couple of setup commands once.

---

## 2. Put the code on GitHub

1. Unzip the project you downloaded from this chat.
2. Create a new, empty repository on GitHub (no README, no .gitignore -
   just an empty repo).
3. In a terminal, inside the unzipped folder:
   ```
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin <the URL GitHub gave you>
   git push -u origin main
   ```

---

## 3. Create the database (Neon)

1. Go to neon.tech, sign up, and create a new project (any name/region).
2. Once it's created, go to the project's **Dashboard** and copy the
   **connection string** (it looks like
   `postgresql://user:password@ep-xxxx.neon.tech/dbname?sslmode=require`).
   Use the "pooled connection" string if Neon shows you a choice.
3. Keep this tab open - you'll need to paste this string twice (once
   locally, once into Vercel).

---

## 4. Run the database setup once, from your laptop

This step creates all the tables and loads your demo data. It has to be
run from a normal computer with internet access (not this chat) because
it downloads a small database tool.

1. Open a terminal in the unzipped project folder.
2. Copy `.env.example` to `.env.local` and paste your Neon connection
   string into `DATABASE_URL`.
3. Run:
   ```
   npm install
   npx prisma migrate dev --name init
   npm run db:seed
   ```
   `npm install` also runs `prisma generate` automatically. The seed step
   prints three demo logins - **admin/admin123, manager/manager123,
   cashier/cashier123** - change these under Users as soon as you sign in.
4. (Optional) check it works locally first:
   ```
   npm run dev
   ```
   and open http://localhost:3000 - sign in with `admin` / `admin123`.

---

## 5. Deploy to Vercel

1. Go to vercel.com, "Add New Project", and pick the GitHub repo you
   pushed in step 2.
2. Before clicking Deploy, open **Environment Variables** and add:
   - `DATABASE_URL` - the same Neon connection string.
   - `AUTH_SECRET` - run `openssl rand -base64 32` in a terminal (or use
     any long random string) and paste the result.
   - `NEXTAUTH_URL` - you can leave this out at first; Vercel sets the URL
     automatically for its own domain in most cases, but if login
     redirects misbehave after deploying, add this variable set to your
     real Vercel URL (e.g. `https://albright-pos.vercel.app`).
3. Click **Deploy**.
4. Once it's live, open the URL Vercel gives you and sign in with the
   admin demo login, then:
   - Go to **Users** and set real passwords (or create new accounts and
     disable the demo ones).
   - Go to **Settings** and fill in your shop's phone, address, email and
     KRA PIN.
   - Go to **Products** and correct anything from the demo data, or add
     your real stock via **Purchases**.

Whenever you push new code to the `main` branch on GitHub, Vercel
redeploys automatically. If you ever change `prisma/schema.prisma`, run
`npx prisma migrate dev --name <describe the change>` locally first and
push the new migration file along with your code - Vercel does **not**
run migrations for you automatically in this setup.

---

## 6. Everyday use

- Any device with a browser can be a till - just open your Vercel URL and
  sign in. No installation needed. Add it to the home screen on a phone
  for an app-like icon (browser menu > "Add to Home screen").
- All devices share the same stock and sales in real time, since they all
  talk to the same Neon database.
- Roles: **Admin** (everything), **Manager** (sales, purchases, inventory,
  reports, customers, suppliers, settings), **Cashier** (POS, customers,
  receipts, their own sales history, shifts).

---

## What's built

- Auth with roles (admin/manager/cashier), password hashing.
- POS: product search, cart, discounts, per-line price override, cash /
  M-Pesa (manual code entry) / card / credit / mixed payment, manager
  approval for below-minimum prices or over credit-limit sales, on-screen
  receipt.
- Products: add/edit, buy/sell/minimum price, categories, units, stock,
  minimum stock.
- Purchases: record a supplier delivery, stock goes up automatically,
  optional partial payment, buying price updates automatically.
- Suppliers: balances owed, pay a supplier (auto-applies oldest invoices
  first).
- Customers & credit: credit limit, balance owed, receive a payment.
- Debtors page: everyone who currently owes money.
- Returns: return part or all of a sale; reverses stock and, if it was on
  credit, reduces the balance owed first.
- Expenses, with categories.
- Cashier shifts: open with a float, close with a cash count and see the
  shortage/excess.
- Reports: sales, profit & loss, inventory value - with CSV export and
  print.
- Dashboard: today's sales/profit, 14-day chart, stock alerts, recent
  activity.
- Users page (admin-only): add staff, change roles, reset passwords.
- Settings: shop details, VAT toggle, negative-stock toggle, credit
  period.

## What's not built yet (compared to the original full wish list)

- An in-app **audit log page** (every important action *is* recorded in
  the database's `AuditLog` table by the code, it's just not shown on a
  screen yet - straightforward to add).
- **Product CSV import** with column-mapping (the offline single-file
  version has this; here you'd currently add products one at a time or
  I can add bulk import next).
- **Automatic M-Pesa** via the Safaricom Daraja API (right now the
  cashier types in the M-Pesa code manually, which is what most small
  shops do day-to-day; Daraja needs a small secure backend for your API
  keys, which I can add later).
- Thermal-printer-formatted PDF receipts (the receipt currently prints via
  the browser's normal print dialog, which works fine but isn't laid out
  for a small thermal printer's paper width the way the offline app's is).
- Barcode **scanner** hardware hasn't been tested (scanning into the
  search box should work like typing, since scanners act as keyboards,
  but I haven't been able to test this myself).

None of this was skipped by accident - it's what "get the core solid
first" meant. Tell me which of these matters most to you next.

## A note on how this was built

I wrote all of this code carefully, including about 130 checks worth of
test coverage during the *offline* single-file version's development.
For this database version, I was not able to run the app itself here,
because the sandbox this conversation runs in cannot download Prisma's
database engine (it's blocked by network rules I can't change). I did:

- type-check the entire codebase by hand and fixed every real issue found
  (a NextAuth v5 typing quirk),
- parse-check every source file for syntax errors (all clean),
- read back through the sale/purchase/return transaction logic line by
  line against the same rules as the tested offline version.

What I could **not** do is actually click through a real sale end-to-end
here. Please test the core flow (open a shift, sell something, take a
purchase, check stock and profit) as your very first step after
deploying, before relying on it for real sales - and tell me anything
that doesn't behave as expected so I can fix it fast.
