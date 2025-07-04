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
  if (!sheet) {
    throw new Error("❌ Sheet 'Data' not found. Please create it in your spreadsheet.");
  }

  const lastRow = sheet.getLastRow();
  let ackNo;

  if (lastRow > 1) { // If there are existing complaints
    const lastAckNoCell = sheet.getRange(lastRow, 1).getValue();
    if (lastAckNoCell && !isNaN(lastAckNoCell)) {
      ackNo = parseInt(lastAckNoCell) + 1;
    } else {
      ackNo = 1000; // If last Ack No is blank or invalid, reset to 1000
    }
  } else {
    ackNo = 1000; // If no previous complaints, start from 1000
  }

  const newRow = lastRow + 1;

  // Determine which channel to set as 'Raised'
  let faultApp = "", whatsapp = "", email = "", customerCare = "";

  switch (data.mode.toLowerCase()) {
    case "fault app":
      faultApp = "Raised";
      break;
    case "whatsapp":
      whatsapp = "Raised";
      break;
    case "e-mail":
    case "email":
      email = "Raised";
      break;
    case "customer care":
      customerCare = "Raised";
      break;
  }

  const values = [[
    ackNo,                // Column A: Ack No
    data.date,            // Column B: Date
    data.time,            // Column C: Time
    data.station,         // Column D: Station
    data.mode,            // Column E: Mode
    data.scm,             // Column F: SCM No
    data.name || "",      // Column G: Name
    data.mobile || "",    // Column H: Mobile
    data.type,            // Column I: Type
    data.description,     // Column J: Description
    "",                   // Column K: Additional Info
    "",                   // Column L: Status
    "",                   // Column M: Fault Closed Date
    "",                   // Column N: Mail Sent Date
    "",                   // Column O: Mail Status
    faultApp,             // Column P: Fault App
    whatsapp,             // Column Q: Whatsapp
    email,                // Column R: E-mail
    customerCare          // Column S: Customer Care
  ]];

  sheet.getRange(newRow, 1, 1, values[0].length).setValues(values);
  return "✅ Complaint submitted successfully with Ack No: " + ackNo;
}

// Get pending mails
function getPendingMails() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Data");
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
    const mailStatus = row[14];

    if (!mailStatus || mailStatus === "") {
      pending.push({ ackNo, scm, mobile, amount, type, description });
    }
  }
  return pending;
}

// Mark mail as sent
function markMailSentAndClose(ackNo) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Data");
  const data = sheet.getDataRange().getValues();
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");

  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString() === ackNo.toString()) {
      sheet.getRange(i + 1, 14).setValue(today); // Mail Sent Date (Column N)
      sheet.getRange(i + 1, 15).setValue("Sent"); // Mail Status (Column O)
      return "✅ Mail sent status updated for Ack No: " + ackNo;
    }
  }
  return "❌ Ack No not found.";
}

// Mark complaint as replied in appropriate column
function updateRepliedStatus(ackNo) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Data");
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString() === ackNo.toString()) {
      const channels = [17, 18, 19]; // Whatsapp (Q), E-mail (R), Customer Care (S)
      for (let c of channels) {
        let val = sheet.getRange(i + 1, c).getValue();
        if (val === "Raised") {
          sheet.getRange(i + 1, c).setValue("Replied");
          return "✅ Replied updated in channel for Ack No: " + ackNo;
        }
      }
      return "ℹ️ No 'Raised' found to update for Ack No: " + ackNo;
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
      sheet.getRange(i + 1, 12).setValue("Closed"); // Status (Column L)
      sheet.getRange(i + 1, 13).setValue(closedDate); // Fault Closed Date (Column M)
      return "✅ Fault closed successfully for Ack No: " + ackNo;
    }
  }
  return "❌ Ack No not found.";
}

