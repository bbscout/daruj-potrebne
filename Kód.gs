GOOGLE_SHEET_ID = "ID_GOOGLE_TABULKY"; //DOPLŇ UNIKÁTNÍ ID GOOGLE TABULKY (ta část URL mezi "d/" a "/edit" -> ".../d/{ID_TABULKY}/edit...")

PLACES_SHEET = "Sběrná místa";
PLACES_FIELDS = [
  { name: "Adresa místa", key: "adresa" },
  { name: "Otevírací doba", key: "otevreno" }
]


REQUESTS_SHEET = "Poptávky";
REQUESTS_FIELDS = [
  { name: "ID", key: "id" },
  { name: "Datum", key: "datum" },
  { name: "Věc", key: "vec" },
  //{ name: "Velikost", key: "velikost" },
  //{ name: "Kategorie", key: "kategorie" },
  { name: "Jméno", key: "jmeno" },
  { name: "Příjmení", key: "prijmeni" },
  { name: "Adresa / místo dodání", key: "adresa" },
  { name: "Telefon", key: "telefon" },
  { name: "Email", key: "email" },
  { name: "Poznámka", key: "poznamka" },
  { name: "Rezervace", key: "rezervace" },
  { name: "Nabízí", key: "nabizi" },
  { name: "Předáno", key: "predano" }
];

OFFERS_SHEET = "Nabídky";
OFFERS_FIELDS = [
  { name: "Nabídka", key: "nabidka" },
  { name: "Datum", key: "datum" },
  { name: "Jméno", key: "jmeno" },
  { name: "Příjmení", key: "prijmeni" },
  { name: "Místo předání", key: "misto" },
  { name: "Telefon", key: "telefon" },
  { name: "Email", key: "email" },
  { name: "Poznámka", key: "poznamka" }
];

EMAIL_DETAILS = {
  linkToForm: "https://sjp.skauting.cz/pomahame-ukrajine/",
  name: "Junák – český skaut, středisko Jiřinky Paroubkové Domažlice, z. s.",
  address: "Zahradní 518\nDomažlice\n344 01", //\n slouží k zalomení řádku
  email: "pomoc.uk@skaut.cz",
  phone: "123"
}


function doGet() {
  var template = HtmlService.createTemplateFromFile(`index.html`);
  return template.evaluate().setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function init() {
  var ss = SpreadsheetApp.openById(GOOGLE_SHEET_ID);
  var requests = ss.getSheetByName(REQUESTS_SHEET);
  if (!requests) {
    requests = ss.insertSheet(REQUESTS_SHEET);
    requests.appendRow(REQUESTS_FIELDS.map(field => field.name));
  }

  var offers = ss.getSheetByName(OFFERS_SHEET);
  if (!offers) {
    offers = ss.insertSheet(OFFERS_SHEET);
    offers.appendRow(OFFERS_FIELDS.map(field => field.name));
  }

  var places = ss.getSheetByName(PLACES_SHEET);
  if (!places) {
    places = ss.insertSheet(PLACES_SHEET);
    places.appendRow(PLACES_FIELDS.map(field => field.name));
  }
}

function appendData(data, sheetName, fields) {
  var ss = SpreadsheetApp.openById(GOOGLE_SHEET_ID);
  var sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    init();
    sheet = ss.getSheetByName(sheetName);
  }

  var index = sheet.getLastRow() + 1;
  var processedData = [];
  for (var i = 0; i < data.length; i++) {
    var item = data[i];
    item.datum = new Date();
    item.id = `${item.datum.getTime()}${Math.floor(Math.random() * 100)}`;
    item.telefon = !item.telefon ? item.telefon : "'" + item.telefon;
    item.rezervace = `=COUNTIF('Nabídky'!$A$2:$A;"="&A${index})>0`;
    item.nabizi = `=IFNA(VLOOKUP(A${index};'Nabídky'!$A$2:$C;3;FALSE)&" "&VLOOKUP(A${index};'Nabídky'!$A$2:$E;4;FALSE);"")`;

    sheet.appendRow(fields.map(field => item[field.key]))
    if(!item.nabidka) {
      sheet.getRange(index,fields.length-2).insertCheckboxes();
      sheet.getRange(index,fields.length).insertCheckboxes();
    }
    processedData.push(item)
    index++
  }
  return processedData
}

function addRequest(data) {
  appendData(data,REQUESTS_SHEET,REQUESTS_FIELDS);
  return true
}

function addOffer(data) {
  var offers = appendData(data,OFFERS_SHEET,OFFERS_FIELDS);

  var requestIds = offers.map(el => el.nabidka);
  var requests = returnRequestsByIds(requestIds);

  var body = requestsToPlainText(offers, requests);

  var htmlTemplate = HtmlService.createTemplateFromFile('offerEmailTemplate');  
  htmlTemplate.details = EMAIL_DETAILS;
  htmlTemplate.offers = offers[0];
  htmlTemplate.requests = requests;
  var htmlBody = htmlTemplate.evaluate().getContent();

  GmailApp.sendEmail(offers[0].email,"PRO UKRAJINU: Detaily k vybraným poptávkám", body, {
    htmlBody: htmlBody
  });

  return true
}

function returnRequestsByIds(ids) {
  ids = ids.map(str => parseInt(str));

  var ss = SpreadsheetApp.openById(GOOGLE_SHEET_ID);
  var requestsSheet = ss.getSheetByName(REQUESTS_SHEET);
  var dataRange = requestsSheet.getDataRange();
  var values = dataRange.getValues();

  var keys = REQUESTS_FIELDS.map(field => field.key);
  idIndex = keys.indexOf('id');

  var requests = [];

  for (var i = 0; i < values.length; i++)
  {
    if (ids.includes(parseInt(values[i][idIndex]))) {
      var request = {};
      keys.map((key, index) => {
        request[key] = values[i][index]
      })
      requests.push(request);
    }
  }

  return requests;
}

function getRequests() {
  var ss = SpreadsheetApp.openById(GOOGLE_SHEET_ID);
  var sheet = ss.getSheetByName(REQUESTS_SHEET);

  if (!sheet) {
    init();
    sheet = ss.getSheetByName(REQUESTS_SHEET);
  }

  var values = sheet.getRange(2,1,sheet.getLastRow() - 1,sheet.getLastColumn()).getValues();

  var keys = REQUESTS_FIELDS.map(field => field.key);
  thingIndex = keys.indexOf('vec');
  reservationIndex = keys.indexOf('rezervace');
  solvedIndex = keys.indexOf('predano');
  idIndex = keys.indexOf('id');

  var requests = values.filter(row => {
    return !row[solvedIndex]
  })

  requests = requests.map(row => {
    return { "id": row[idIndex], "vec": row[thingIndex], "rezervace": row[reservationIndex] }
  })


  return requests;
}

function getPlaces() {
  var ss = SpreadsheetApp.openById(GOOGLE_SHEET_ID);
  var sheet = ss.getSheetByName(PLACES_SHEET);

  if (!sheet) {
    init();
    sheet = ss.getSheetByName(PLACES_SHEET);
  }

  var values = sheet.getRange(2,1,sheet.getLastRow() - 1,sheet.getLastColumn()).getValues();

  var keys = PLACES_FIELDS.map(field => field.key);

  var places = values.map(row => {
    var obj = {};
    for(var i = 0; i < row.length; i++) {
      obj[keys[i]] = row[i];
    }
    return obj
  })

  return places;
}

function requestsToPlainText(offers, requests) {
  var offer = offers[0];
  var requestsList = "";

  requests.forEach(request => {
    requestsList += 
` Poptávaná věc: ${request.vec}
Jméno: ${request.jmeno}
Příjmení: ${request.prijmeni}
Adresa / místo dodání: ${request.adresa}
Telefon: ${request.telefon}
Email: ${request.email}
Poznámka: ${request.poznamka}
----------
`
  })

  var body = 
`Děkujeme za Vaši nabídku,
kontaktujte prosím poptávajícího nejlépe na zadaném telefonním čísle (případně emailu) o způsobu doručení daných věcí. Pokud poptávající neuvedl žádný kontakt, zkuste vybranou věc předat na místo určení. Pro překlad zprávy do ukrajinského jazyka můžete použít například Google překladač (https://translate.google.com/?sl=cs&tl=uk&op=translate). V případě problémů nás kontaktujte.

Pokud jste jako způsob předání zvolili "osobní předání", pak považujeme tuto poptávku za uzavřenou. Pokud by k předání nedošlo, kontaktujte nás prosím na níže uvedeném emailu nebo telefonním čísle.
          
 Vaše nabídka:
 Jméno: ${offer.jmeno}
Příjmení: ${offer.prijmeni}
Způsob předání: ${offer.misto}
Telefon: ${offer.telefon.replace("'","")}
Email: ${offer.email}
Poznámka: ${offer.poznamka}

==========

Detaily k vybraným poptávkám:
----------
${requestsList}
${ EMAIL_DETAILS.name ? EMAIL_DETAILS.name : "" }
${ EMAIL_DETAILS.address ? EMAIL_DETAILS.address : "" }
${ EMAIL_DETAILS.email ? "email: " + EMAIL_DETAILS.email : "" }
${ EMAIL_DETAILS.phone ? "telefon: " + EMAIL_DETAILS.phone : "" }`;

return body
}