# Neostrada to OpenProvider

Migrating DNS records can be a tedious task, especially when you have a large number of domains. This script automates the process of preparing the DNS zone data at OpenProvider by extracting the data from Neostrada.
This way, you only have to double-check the DNS zone before manually transferring the domains to OpenProvider.

> [!CAUTION]
> This script is provided as-is and should be used with caution. Make sure to be mindful of the API access and the data you are working with. Always double-check the DNS zone data before transferring the domains to OpenProvider. It is your responsibility to ensure the data is correct and the migration is successful. I am not responsible for any data loss or incorrect DNS zones.

## Features

- Bulk export all active domains from Neostrada to a JSON file.
- Bulk export the DNS zone data and import it to OpenProvider.

## Prerequisites

- Copy the `.env.example` file to `.env`.
- API access to Neostrada (Bearer token obtained via your Neostrada account).
   - Add the token as the `NEOSTRADA_API_KEY` in the `.env` file.
- API access to OpenProvider
   - Create a beared token by running `curl -X POST https://api.openprovider.eu/v1beta/auth/login  -d '{"username": "YOUR-EMAIL", "password": "YOUR-PASSWORD", "ip": "x.x.x.x"}'`. where the `ip` is your current IP address.
   - Add the token as the `OPENPROVIDER_API_KEY` in the `.env` file.
   - Make sure your account has access to the OpenProvider API. This can be activated via the [OpenProvider dashboard](https://cp.openprovider.eu/account/dashboard.php), clicking on your name -> API -> click edit, scroll down and enable the API.

## Requirements

- Node.js >= 14
- Neostrada API access
- OpenProvider API access

## Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/levdbas/neostrada-to-openprovider.git
cd neostrada-to-openprovider
npm install
```

## Usage

1. Configure your credentials in the `.env` file:
   ```env
   NEOSTRADA_API_KEY=your_neostrada_api_key
   OPENPROVIDER_API_KEY=your_openprovider_api_key
   ```

2. Run `node create-neostrada-domain.js` to create a json file with all active domains at Neostrada.

3. Manually check the `neostrada-domains.json` file, pick a few domains and add them to the neostrada-domains.json file.

4. Now run `node index.js` to loop through the domains in the `neostrada-domains.json` file and start the migration process.

5. Inside the `output` folder, you will find a json file for each domain with the DNS zone data. Use this data to manually check the imported DNS zone data at OpenProvider.

6. Manually transfer the domains to OpenProviders. Since the DNS zone data is already prepared, you can just start the transfer process and you are good to go.

## Contributing

Contributions are welcome! Please fork the repository and submit a pull request.

## License

This project is licensed under the [MIT License](LICENSE).