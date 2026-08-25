# Security

## Reporting

Please report a suspected vulnerability privately to the repository owner. Do not include credentials, private URLs, personal data, or a working exploit in an ordinary issue.

## Secrets policy

The application requires no API keys for local development. Keep all deployment credentials outside the repository and provide them only through the target platform's secret manager.

The following must never be committed:

- passwords, access tokens, cookies, or authorization headers;
- `.env` files and private keys;
- internal IP addresses, NAS paths, database dumps, or Portainer exports;
- production logs containing personal or authentication data.

If a secret is committed, revoke or rotate it first; removing it from the latest commit is not enough.
