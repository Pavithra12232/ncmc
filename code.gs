// Serve the web app with routing
function doGet(e) {
  const page = e && e.parameter && e.parameter.page;

  if (page === "complaint") {
    return HtmlService.createHtmlOutputFromFile('Index');
  } else if (page === "mail") {
    return HtmlService.createHtmlOutputFromFile('MailSent');
  } else if (page === "replied") {
    return HtmlService.createHtmlOutputFromFile('Replied');
  } else if (page === "closefault") {
    return HtmlService.createHtmlOutputFromFile('CloseFault');
  } else if (page === "dashboard") {
    return HtmlService.createHtmlOutputFromFile('Dashboard');
  } else {
    return HtmlService.createHtmlOutputFromFile('Login');
  }
}

// Login check
function checkLogin(username, password) {
  const defaultUsername = "admin";
  const defaultPassword = "admin123";

  if (username === defaultUsername && password === defaultPassword) {
    return "success";
  } else {
    return "fail";
  }
}

// Return form HTMLs
function getComplaintForm() {
  return HtmlService.createHtmlOutputFromFile('Index').getContent();
}

function getMailSentForm() {
  return HtmlService.createHtmlOutputFromFile('MailSent').getContent();
}

function getRepliedForm() {
  return HtmlService.createHtmlOutputFromFile('Replied').getContent();
}

function getCloseFaultForm() {
  return HtmlService.createHtmlOutputFromFile('CloseFault').getContent();
}

function getLoginForm() {
  return HtmlService.createHtmlOutputFromFile('Login').getContent();
}

function getDashboard() {
  return HtmlService.createHtmlOutputFromFile('Dashboard').getContent();
}

// Submit complaint with auto-generated sequential Ack No and auto-raise in mode column
function submitComplaintToSheet(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Data");
  if (!sheet) throw new Error("❌ Sheet 'Data' not found.");

  const lastRow = sheet.getLastRow();
  let ackNo;

  if (lastRow > 1) {
    const lastAckNoCell = sheet.getRange(lastRow, 1).getValue();
    ackNo = lastAckNoCell && !isNaN(lastAckNoCell) ? parseInt(lastAckNoCell) + 1 : 1000;
  } else {
    ackNo = 1000;
  }

  const newRow = lastRow + 1;

  // Determine which channel to set as 'Raised'
  let faultApp = "", whatsapp = "", email = "", customerCare = "";
  switch (data.mode.toLowerCase()) {
    case "fault app": faultApp = "Raised"; break;
    case "whatsapp": whatsapp = "Raised"; break;
    case "e-mail": case "email": email = "Raised"; break;
    case "customer care": customerCare = "Raised"; break;
  }

  const values = [[
    ackNo, data.date, data.time, data.station, data.mode, data.scm,
    data.name || "", data.mobile || "", data.type, data.description,
    "", "", "", "", "",
    faultApp, whatsapp, email, customerCare
  ]];

  sheet.getRange(newRow, 1, 1, values[0].length).setValues(values);
  return "✅ Complaint submitted with Ack No: " + ackNo;
}

// Mark mail as sent and close
function markMailSentAndClose(ackNo) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Data");
  const data = sheet.getDataRange().getValues();
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");

  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString() === ackNo.toString()) {
      sheet.getRange(i + 1, 14).setValue(today); // Mail Sent Date (N)
      sheet.getRange(i + 1, 15).setValue("Sent"); // Mail Status (O)
      return "✅ Mail sent status updated for Ack No: " + ackNo;
    }
  }
  return "❌ Ack No not found.";
}

// Mark complaint as replied in correct mode column
function markAsReplied(ackNo, mode) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Data");
  const data = sheet.getDataRange().getValues();

  const modeMap = {
    "fault app": 16, // P
    "whatsapp": 17, // Q
    "e-mail": 18,   // R
    "email": 18,    // R
    "customer care": 19 // S
  };

  const colIndex = modeMap[mode.toLowerCase()];
  if (!colIndex) return "❌ Invalid mode selected.";

  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString() === ackNo.toString()) {
      let val = sheet.getRange(i + 1, colIndex).getValue();
      if (val === "Raised") {
        sheet.getRange(i + 1, colIndex).setValue("Replied");
        return `✅ Updated to 'Replied' under ${mode} for Ack No: ${ackNo}`;
      } else {
        return `ℹ️ No 'Raised' found under ${mode} for Ack No: ${ackNo}`;
      }
    }
  }
  return "❌ Ack No not found.";
}

// Close fault
function closeFault(ackNo, closedDate) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Data");
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString() === ackNo.toString()) {
      sheet.getRange(i + 1, 12).setValue("Closed"); // Status (L)
      sheet.getRange(i + 1, 13).setValue(closedDate); // Fault Closed Date (M)
      return "✅ Fault closed for Ack No: " + ackNo;
    }
  }
  return "❌ Ack No not found.";
}
