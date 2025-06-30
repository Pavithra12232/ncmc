// Serve the web app with routing
function doGet(e) {
  const page = e && e.parameter && e.parameter.page;

  if (page === "complaint") {
    return HtmlService.createHtmlOutputFromFile('Index');
  } else if (page === "mail") {
    return HtmlService.createHtmlOutputFromFile('MailSent');
  } else {
    return HtmlService.createHtmlOutputFromFile('Login');
  }
}

// Check login credentials using default username and password
function checkLogin(username, password) {
  const defaultUsername = "admin";     // your default username
  const defaultPassword = "admin123";  // your default password

  if (username === defaultUsername && password === defaultPassword) {
    return "success";
  } else {
    return "fail";
  }
}

// Return complaint form HTML content after successful login
function getComplaintForm() {
  return HtmlService.createHtmlOutputFromFile('Index').getContent();
}

// Return mail sent form HTML content after successful login
function getMailSentForm() {
  return HtmlService.createHtmlOutputFromFile('MailSent').getContent();
}

// Handle complaint submission from Index.html
function submitComplaintToSheet(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Data");

  const lastRow = sheet.getLastRow() + 1;

  const values = [[
    data.date,           // B
    data.time,           // C
    data.station,        // D
    data.mode,           // E
    data.scm,            // F
    data.name || "",     // G
    data.mobile || "",   // H
    data.type,           // I
    data.description,    // J
    ""                   // K: optional/extra
  ]];

  sheet.getRange(lastRow, 2, 1, values[0].length).setValues(values);
  return "✅ Complaint submitted successfully!";
}

// Get pending mails list with details
function getPendingMails() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Data");
  const data = sheet.getDataRange().getValues();

  const pending = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const ackNo = row[0];
    const scm = row[5];
    const mobile = row[6];
    const amount = row[7];
    const type = row[8];
    const description = row[9];
    const mailStatus = row[13]; // Adjust column index as per your Data sheet

    if (!mailStatus || mailStatus === "") {
      pending.push({
        ackNo, scm, mobile, amount, type, description
      });
    }
  }

  return pending;
}

// Mark mail as sent for a specific Ack No
function markMailSent(ackNo) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Data");
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString() === ackNo.toString()) {
      sheet.getRange(i + 1, 14).setValue(new Date()); // Mail Sent Date
      sheet.getRange(i + 1, 15).setValue("Sent");     // Mail Status
      return "✅ Mail sent status updated for Ack No: " + ackNo;
    }
  }

  return "❌ Ack No not found.";
}
