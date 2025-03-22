require("dotenv").config();
const fs = require("fs");
const axios = require("axios");

// API Configuratie
const NEOSTRADA_API_KEY = process.env.NEOSTRADA_API_KEY;
const OPENPROVIDER_API_KEY = process.env.OPENPROVIDER_API_KEY;
const JSON_FILE = process.env.JSON_FILE;

// API Endpoints
const NEOSTRADA_API_URL = "https://api.neostrada.com/api/dns";
const OPENPROVIDER_API_URL = "https://api.openprovider.eu/v1beta/dns/zones";

// Laad domeinen uit JSON-bestand
function loadDomains() {
   try {
      const data = fs.readFileSync(JSON_FILE, "utf8");
      return JSON.parse(data).domains || [];
   } catch (error) {
      console.error("❌ Fout bij het laden van het JSON-bestand:", error.message);
      return [];
   }
}

// Haal DNS-records op van Neostrada
async function getDnsRecords(dnsId) {
   try {
      const response = await axios.get(`${NEOSTRADA_API_URL}/${dnsId}`, {
         headers: { Authorization: `Bearer ${NEOSTRADA_API_KEY}` },
      });

      if (response.data.results) {
         return response.data.results;
      } else {
         console.error(`❌ Fout bij ophalen records: ${response.data.message}`);
      }
   } catch (error) {
      console.error("❌ API-fout bij ophalen records:", error.message);
   }
   return [];
}

// Filtert SOA & NS records eruit
function filterRecords(records) {
   records = records.filter((record) => !["SOA", "NS"].includes(record.type));

   // loop through the records and remove records that do not have a key 'content'
   records = records.filter(record => record.hasOwnProperty('content'));

   // if record name value contains localhost, remove the record
   records = records.filter(record => !record.name.includes
      ('localhost'));


   // if record type is CNAME and name contains 'email.mg', remove the record
   records = records.filter(record => !(record.type === 'CNAME' && record.name.includes('email.mg')));

   return records;
}

//  a function that loops through the recods and remove id and domainID from the record
function removeIdAndDomainId(records) {
   records = records.map(record => {
      delete record.id;
      delete record.domainId;
      record.value = record.content;
      delete record.content;

      return record;
   });

   // loop through records, if the key "name" contains 2 or more dots, remove everything after the second last dot
   records = records.map(record => {
      if (record.name.split('.').length > 2) {
         const nameParts = record.name.split('.');
         record.name = nameParts.slice(0, nameParts.length - 2).join('.');
      }

      return record
   }
   );

   return records;
}

// Maak DNS-zone aan bij Openprovider
async function createOpenproviderZone(domain, records) {

   // get the extension of the domain
   const domainParts = domain.split(".");
   const extension = domainParts[domainParts.length - 1];
   const name = domainParts[0];

   try {
      const response = await axios.post(
         OPENPROVIDER_API_URL,
         {
            "domain": {
               "extension": extension,
               "name": name,
            },
            "is_spamexperts_enabled": "off",
            "provider": "openprovider",
            "records": records,
            "secured": true,
            "template_name": "api",
            "type": "master"
         },
         { headers: { Authorization: `Bearer ${OPENPROVIDER_API_KEY}`, "Content-Type": "application/json" } }
      );

      if (response.data.data.success) {
         console.log(`✅ Succes: DNS-zone aangemaakt voor ${domain}`);
      } else {
         console.error(`❌ Fout bij aanmaken DNS-zone voor ${domain}: ${response.data.data.desc}`);
      }
   } catch (error) {
      console.error("❌ API-fout bij aanmaken DNS-zone:", error.message);
   }
}





// Hoofdscript
async function migrateDns() {
   const domains = loadDomains();
   if (domains.length === 0) {
      console.log("⚠️ Geen domeinen gevonden om te migreren.");
      return;
   }

   for (const { domain, dns_id: dnsId } of domains) {
      console.log(`➡️ Ophalen van DNS-records voor ${domain} (ID: ${dnsId})...`);

      const records = await getDnsRecords(dnsId);
      let filteredRecords = filterRecords(records);
      filteredRecords = removeIdAndDomainId(filteredRecords);


      if (filteredRecords.length === 0) {
         console.log(`⚠️ Geen bruikbare DNS-records voor ${domain}, wordt overgeslagen.`);
         continue;
      }

      fs.writeFileSync
         (`./output/${domain}.json`, JSON.stringify(filteredRecords, null, 2), 'utf8');
      console.log(`✅ ${domain}.json is aangemaakt`);

      console.log(`📌 Migreren van ${filteredRecords.length} DNS-records naar Openprovider voor ${domain}...`);
      await createOpenproviderZone(domain, filteredRecords);
   }
}

// Start migratie
migrateDns();
