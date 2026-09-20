# Running the salon on the cashier PC

This puts the whole system on one PC in the salon. Stylists' tablets open it over
the salon Wi-Fi, so **checkout keeps working when the internet is down.** The
router only has to be on.

```
 tablets ──Wi-Fi──► router ◄──cable──► cashier PC  (app + database live here)
                       │
                   (internet: optional)
```

## What this does and does not do

**Does:** tickets, services, checkout, invoices, commissions and stock, all
stored on the cashier PC and working with no internet. Payment is always
confirmed by hand at the till; there is no online payment.

**Does not, yet:**

- **It is not connected to the cloud database.** Orders taken here do not appear
  in the cloud reports, and the cloud app cannot see them. Syncing the two is a
  separate, later piece of work. Until then this PC is the only place today's
  business exists, which is why the backup step below is not optional.
- **The public website and its booking form are unaffected** — they stay in the
  cloud.

## Before you start

- A Windows PC that stays on during opening hours, wired to the router by cable.
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed.
  Open its settings and turn on **Start Docker Desktop when you sign in**.
- Git, or a copy of this project folder on the PC.

## 1. Fill in the settings

In the project folder, copy `.env.cashier.example` to `.env.cashier` and fill it in:

| Setting | What to put |
|---|---|
| `POSTGRES_PASSWORD` | Any long password made of letters and digits. |
| `AUTH_SECRET` | Run `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` and paste the result. |
| `OWNER_EMAIL`, `OWNER_PASSWORD` | Your first login. At least 10 characters. Change the password inside the app afterwards. |

`.env.cashier` holds secrets and is ignored by git. Keep a copy somewhere safe: if
the PC dies you will need the same values.

## 2. Start it

```powershell
docker compose -f docker-compose.cashier.yml --env-file .env.cashier up -d --build
```

The first run takes several minutes while it builds. It then sets up the database
and creates your owner login. Check on it with:

```powershell
docker compose -f docker-compose.cashier.yml ps
```

`berchi-cashier-app` should say `healthy`. Open <http://localhost:3000> on the PC
and sign in with the owner login.

It restarts itself after a reboot as long as Docker Desktop starts. Make the PC
sign in on its own after a power cut (Windows: `netplwiz`), or the salon opens to
a login screen and nothing is running until someone signs in.

## 3. Give the PC a fixed address

Tablets need an address that never changes. The reliable way is in the **router**,
not Windows: find the DHCP or "address reservation" page, and reserve one address
for the cashier PC (say `192.168.1.50`). Find the PC's current address with
`ipconfig`.

Then allow tablets through the Windows firewall (run PowerShell as Administrator):

```powershell
New-NetFirewallRule -DisplayName "Berchi salon" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Private
```

Windows must call the salon network **Private** (Settings, Network, your
connection). On a Public network the rule above does nothing.

## 4. Connect a tablet

On a tablet joined to the salon Wi-Fi, open `http://192.168.1.50:3000` (use your
own address), sign in, and add the page to the home screen.

If it will not load:

1. Can the tablet reach the PC at all? Many routers have **AP / client isolation**
   (sometimes called "guest network" or "wireless isolation") that stops devices
   talking to each other. It must be off for this network.
2. Is the salon network set to Private on the PC (step 3)?
3. Is the app healthy? (`docker compose ... ps`)

## 5. Backups

Everything is on this one PC's disk, so a backup on that same disk is not a
backup. The nightly backup is copied into a **cloud-synced folder** (OneDrive,
Google Drive or Dropbox), and the sync app uploads it.

Before you start:

- Install the sync app on this PC and sign in with the **owner's** account, not
  one shared with staff. The backups contain customer names and phone numbers.
- Check the app is running and set to start when Windows starts.

Then, in PowerShell in the project folder:

```powershell
.\scripts\install-backup-task.ps1
```

It finds your sync folder (or pass `-Copy "D:\MyDrive\berchi-backups"`), schedules
a backup for 22:30 every night, and takes one straight away to prove it works. If
the PC is off at 22:30, the backup runs as soon as it is next switched on. Each
backup is checked by reading it back, and old ones are cleared after 30 days.

**Look at your cloud account once** and confirm the file really arrived there. The
scripts can only see this PC's side of the sync.

To check on it any time:

```powershell
.\scripts\backup-status.ps1
```

It reports how old the newest backup is in both places, and says so if the
schedule is missing or a night was missed. Run it every week or two.

Backups do not include `.env.cashier`. Keep a copy of that somewhere safe, or a
restored PC will not be able to start.

**Practise restoring before you need it.** Restoring replaces everything:

```powershell
.\scripts\restore.ps1 -File .\backups\berchi-20260920-223000.dump          # only explains
.\scripts\restore.ps1 -File .\backups\berchi-20260920-223000.dump -Yes     # does it
```

To restore from the cloud copy, download the newest `.dump` file to this PC first
and point `-File` at it.

## 6. Updating

Take a backup first, then:

```powershell
git pull
docker compose -f docker-compose.cashier.yml --env-file .env.cashier up -d --build
```

Database changes are applied automatically. Do this outside opening hours; the app
is unavailable for a minute while it restarts.

## 7. Prove it survives an outage

Do this once, before relying on it. With a tablet on the Wi-Fi, unplug the
router's **internet** cable (leave the router powered). Open a ticket on the
tablet, add a service, send it, and check it out on the cashier PC. All of it
should work.

## Good to know

- Stylists see changes on the cashier screen instantly. If a screen loses its
  connection it catches up as soon as it reconnects.
- If several people report the app is down: `docker compose -f docker-compose.cashier.yml logs app --tail 50`.
- The database is not reachable from the Wi-Fi, by design. Only the app can talk
  to it.
