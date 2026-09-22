# Deploying the public site (berchibeauty.com)

The Docker image built from `Dockerfile` runs the Next.js standalone server on
port 3000, listening on `0.0.0.0`. Something in front of it terminates TLS and
forwards to that port. Two settings have to agree with that arrangement, or
sign-in fails.

## The two settings that matter

| Setting | Value | Why |
|---|---|---|
| `AUTH_SECRET` | 32 random bytes | Signs the session. Changing it logs everyone out. |
| `AUTH_URL` | `https://berchibeauty.com` | The address browsers use. Without it, **login cannot work at all.** |

```bash
docker run -d --name berchi-app -p 3000:3000 \
  -e DATABASE_URL='postgres://...' \
  -e AUTH_SECRET='...' \
  -e AUTH_URL='https://berchibeauty.com' \
  berchi-salon
```

Migrations and the first owner come from the `tools` image stage, exactly as in
`docker-compose.cashier.yml`.

## Why login breaks without `AUTH_URL`

Auth.js will not answer a request whose `Host` header it has not been told to
trust. Off Vercel, in `NODE_ENV=production`, it trusts nothing until `AUTH_URL`
or `AUTH_TRUST_HOST` is set. Miss both and every request through
`/api/auth/*` — providers, session, callback — fails the same way:

```
[auth][error] UntrustedHost: Host must be trusted.
  URL was: https://berchibeauty.com/api/auth/session
```

Note that the domain in that message is the right one. The error is not saying
the host is wrong; it is saying nobody vouched for it.

## Why `AUTH_URL` and not `AUTH_TRUST_HOST`

`AUTH_TRUST_HOST=true` makes the app believe whatever `Host` the proxy sends.
nginx, unless told otherwise, sends the address it was proxying *to* —
`proxy_set_header Host $proxy_host`, i.e. `0.0.0.0:3000`. So the same log
usually carries a second, stranger line:

```
  URL was: https://0.0.0.0:3000/api/auth/providers
```

Trusting that host stops the error but starts a worse problem: login redirects
and session cookies get built against `0.0.0.0:3000`, so the browser is sent
somewhere it cannot reach and the cookie never comes back. `AUTH_URL` avoids the
question — each incoming request is rewritten to that origin before Auth.js sees
it, so a mis-set `Host` cannot reach the login flow.

Worth fixing the proxy anyway:

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host              $host;       # not the default $proxy_host
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host  $host;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
}
```

`X-Forwarded-Proto` has to say `https`. It is what tells the app to mark the
session cookie `Secure`; get it wrong and the browser drops the cookie on a
TLS site, which looks like a login that silently bounces back to `/login`.

## The cashier PC is different

`docker-compose.cashier.yml` sets `AUTH_TRUST_HOST=true` and no `AUTH_URL`, on
purpose: tablets reach that machine by its LAN address and the till reaches it at
`localhost`, so there is no single correct origin to pin. That is safe on the
salon LAN with no proxy in front. Do not copy it to a public deployment.

Leave `ENABLE_PIN_LOGIN` off here for the same reason — a 4-digit PIN belongs
behind the salon's own Wi-Fi, not on the open internet.

## "Too many redirects" after a successful login

Different problem, same deploy. Sign-in works, and then the browser gives up:

```
ERR_TOO_MANY_REDIRECTS
```

The migrations create the `permissions`, `roles` and `role_permissions` tables
but put nothing in them — the rows come from `seedPermissions()`, which runs as
part of first-run setup, not as part of `drizzle-kit migrate`. With those tables
empty every permission check returns false, including the owner's.

That used to be invisible. `/` sent an OWNER to `/admin`, `/admin` found no
`dashboard.view` and sent them back to `/`, and around it went. `/` now checks
the permission before redirecting and shows a message instead, so the symptom is
readable — but the cure is the same:

```bash
npm run db:bootstrap            # or: docker compose run --rm setup
```

Then **restart the app**. `hasPermission` memoises its answers in a plain
module-level `Map` that is never invalidated, so a running container holds on to
the `false` it learned before the seed and keeps refusing everything.

Worth knowing: `npm run db:seed` is the demo seeder. It creates an owner but no
permissions, so seeding with it alone produces exactly this dead end. Real
installs use `db:bootstrap`, which seeds permissions first and then the owner.
