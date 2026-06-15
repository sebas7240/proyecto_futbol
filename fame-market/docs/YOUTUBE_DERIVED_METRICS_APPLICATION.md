# YouTube Derived Metrics Application

Prepared on: June 15, 2026

Status: deferred until the final brand and domain are selected and publicly
deployed. Keep this file as a draft and do not submit provisional URLs.

This document prepares the YouTube Data API Services Audit and Quota Extension
Form. It does not replace the form and must not be submitted until the public
HTTPS site and its evidence are available.

Official form:

https://support.google.com/youtube/contact/yt_api_form

Official additional policy:

https://developers.google.com/youtube/terms/derived-metrics-policy

## Current blockers

- The final domain has not been selected or deployed.
- Production must expose `/`, `/privacidad`, `/reglas`, `/metodologia` and
  `/derechos`.
- The legal owner, address, contact email and Google Cloud project number must
  be entered by the account owner.
- Required screenshots or PDFs must be captured from the deployed production
  application.

Do not claim approval and do not use YouTube data in the price index before a
positive written response is received.

## Recommended form selections

- Request type: compliance audit to request permission for derived metrics.
- Applicant: individual user.
- Organization legal name: `self`.
- Organization type: Independent Developer/Sole Proprietor.
- Category: Gaming and Esports, or Media and Entertainment if only one may be
  selected.
- API Client name: `Fame Market`.
- Client name contains "YouTube": No.
- Target audience: General Public and Individual Content Creators.
- Current monetization: Free service.
- Google representative: No.
- Use cases:
  - Analytics & Reporting.
  - Websites & Mobile Apps.
- Expected API usage: Fewer than 1,000 requests per day.
- Requested quota: No change / Default quota (10k quota points).
- Endpoints:
  - `youtube.channels.list`
  - `youtube.playlistItems.list`
  - `youtube.videos.list`
- YouTube account OAuth scopes: None. Login uses Firebase Authentication and
  does not request access to a user's YouTube account.

## Business description

Use this draft after replacing the bracketed fields:

> Fame Market is a free fantasy market game about public attention. Players
> receive equal fictional balances and build fictional portfolios of public
> figures. The service displays official YouTube videos and current public
> statistics to help users understand content activity. Prices, balances and
> holdings have no monetary value and do not represent real securities.
>
> We are requesting permission for an Analytics & Reporting use case to
> calculate a clearly labelled, independently generated YouTube attention
> signal. The proposed signal would compare the recent performance of a
> channel's eligible official videos with that same channel's historical
> performance. It would never be presented as a metric published or endorsed
> by YouTube.
>
> The YouTube-derived signal will use only YouTube API Data. It will remain
> isolated from Wikimedia and other external data unless YouTube grants
> explicit written permission to combine them. During an initial shadow period,
> derived results are evaluated without changing game prices.

## Independent value

> Fame Market adds independent value by turning public content activity into an
> educational fantasy game with transparent methodology, equal starting
> balances, weekly seasons and anti-abuse controls. Users can inspect official
> source videos, raw public statistics and the separate explanation of any
> independently calculated signal. The product does not replace YouTube,
> download videos, remove player functionality, or imply creator endorsement.

## Proposed YouTube-only metric

The first requested metric is a channel-relative attention signal:

```text
recent_velocity =
  change in views for eligible recent videos during a fixed recent window

historical_velocity =
  median or average change in views for eligible videos from the same channel
  during an equivalent historical window

youtube_attention_signal =
  bounded(recent_velocity / historical_velocity)
```

Controls:

- Only data returned by YouTube API Services is used in this signal.
- A channel is compared only with its own history.
- The metric has a visible `Calculated independently by Fame Market` label.
- Missing or stale data produces no signal.
- Shorts, live streams and normal videos remain separated.
- The signal starts in shadow mode.
- The algorithm is versioned and auditable.
- No protected audience attributes, estimated reach, watch time, revenue,
  monetization status or ad performance are inferred.
- No wording encourages harassment, brigading or creator rivalries.

## Expected usage

Initial production target:

- 20 to 30 configured public figures.
- One primary official channel per eligible figure.
- Playlist refresh every six hours.
- Batched video statistics refresh every hour when enabled.
- No recurrent `search.list` calls.
- Expected requests remain below 1,000 per day.

Default quota is sufficient. The request is for policy approval, not additional
quota.

## Public URLs after deployment

- Primary URL: `https://DOMINIO-NUEVO/`
- Privacy: `https://DOMINIO-NUEVO/privacidad`
- Terms/rules: `https://DOMINIO-NUEVO/reglas`
- Methodology: `https://DOMINIO-NUEVO/metodologia`
- Rights: `https://DOMINIO-NUEVO/derechos`
- Login: `https://DOMINIO-NUEVO/`
- Admin evidence: provide reviewer instructions or a temporary review account.

## Required evidence checklist

The official form currently requests image or PDF evidence:

- Privacy Policy screenshots showing:
  - The YouTube API Services section.
  - Link to Google's Privacy Policy.
  - Link to YouTube Terms of Service.
  - Data refresh and deletion policy.
- Homepage screenshot showing:
  - The Privacy link.
  - Visible YouTube attribution near YouTube data.
- Terms of Service documentation.
- Dashboard or feature screenshots for Analytics & Reporting:
  - Artist detail with official YouTube statistics.
  - Public methodology page.
  - Admin shadow evaluation dashboard.
- OAuth evidence if Google sign-in is treated as OAuth by the form:
  - Firebase Google login screen.
  - Consent screen showing that no YouTube scopes are requested.

Suggested evidence filenames:

- `01-privacy-youtube-section.pdf`
- `02-homepage-youtube-attribution.png`
- `03-rules.pdf`
- `04-methodology.png`
- `05-admin-shadow-dashboard.png`
- `06-google-login-no-youtube-scopes.png`

## Final owner-provided fields

- Full legal name: `[REQUIRED]`
- Legal/contact address: `[REQUIRED]`
- Country: `[REQUIRED]`
- Primary contact email: `[REQUIRED]`
- Google Cloud project number: `[REQUIRED]`
- Public support contact: `[REQUIRED]`
- Production demo credentials or review instructions: `[REQUIRED]`

## Submission gate

Submit only when all are true:

- Production DNS and HTTPS work.
- Privacy, rules and methodology are publicly reachable.
- Screenshots match the deployed application.
- The Google Cloud project number matches `YOUTUBE_API_KEY`.
- The privacy policy describes current behavior exactly.
- No YouTube-derived score affects price before written approval.
