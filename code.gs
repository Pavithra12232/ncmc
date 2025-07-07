// Serve the web app with routing
function doGet(e) {
  const page = e && e.parameter && e.parameter.page;

  if (page === "complaint") {
    return HtmlService.createHtmlOutputFromFile("Index");
  } else if (page === "mail") {
    return HtmlService.createHtmlOutputFromFile("MailSent");
  } else if (page === "replied") {
    return HtmlService.createHtmlOutputFromFile("Replied");
  } else if (page === "closefault") {
    return HtmlService.createHtmlOutputFromFile("CloseFault");
  } else if (page === "dashboard") {
    return HtmlService.createHtmlOutputFromFile("Dashboard");
  } else {
    return HtmlService.createHtmlOutputFromFile("Login");
  }
}

// Login check
function checkLogin(username, password) {
  const defaultUsername = "admin";
  const defaultPassword = "admin123";
  return username === defaultUsername && password === defaultPassword ? "success" : "fail";
}

// Return form HTMLs
function getComplaintForm() {
  return HtmlService.createHtmlOutputFromFile("Index").getContent();
}

function getMailSentForm() {
  return HtmlService.createHtmlOutputFromFile("MailSent").getContent();
}

function getRepliedForm() {
  return HtmlService.createHtmlOutputFromFile("Replied").getContent();
}

function getCloseFaultForm() {
  return HtmlService.createHtmlOutputFromFile("CloseFault").getContent();
}

function getLoginForm() {
  return HtmlService.createHtmlOutputFromFile("Login").getContent();
}

function getDashboard() {
  return HtmlService.createHtmlOutputFromFile("Dashboard").getContent();
}

// Submit complaint
function submitComplaintToSheet(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Data");
  if (!sheet) throw new Error("❌ Sheet 'Data' not found. Please create it.");

  const lastRow = sheet.getLastRow();
  let nextAckNo = 1000;
  if (lastRow > 1) {
    const lastAckNo = sheet.getRange(lastRow, 1).getValue();
    nextAckNo = Number(lastAckNo) + 1;
  }

  const channels = {
    "Fault App": 16,
    "Whatsapp": 17,
    "E-mail": 18,
    "Customer Care": 19
  };

  const values = [[
    nextAckNo,
    data.date,
    data.time,
    data.station,
    data.mode,
    data.scm,
    data.name || "",
    data.mobile || "",
    data.type,
    data.description,
    "", "", "", "", "", "", "", "", ""
  ]];

  sheet.getRange(lastRow + 1, 1, 1, values[0].length).setValues(values);

  const modeColumn = channels[data.mode];
  if (modeColumn) {
    sheet.getRange(lastRow + 1, modeColumn).setValue("Raised");
  }

  return "✅ Complaint submitted successfully with Ack No: " + nextAckNo;
}

// Get dashboard stats
function getDashboardCounts() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Data");
  const data = sheet.getDataRange().getValues();
  let pendingFaults = 0, pendingMails = 0, pendingReplied = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[11]) pendingFaults++; // Status (L)
    if (!row[14]) pendingMails++;  // Mail Status (O)
    if ([row[16], row[17], row[18], row[19]].includes("Raised")) pendingReplied++; // P-S
  }

  return { pendingFaults, pendingMails, pendingReplied };
}

// Get pending mails count and details
function getPendingMails() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Data");
  const data = sheet.getDataRange().getValues();
  const pending = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const mailStatus = row[14]; // Column O
    if (!mailStatus) { // blank status = pending
      pending.push({
        ackNo: row[0],
        scm: row[5],
        mobile: row[7],
        amount: row[10],
        type: row[8],
        description: row[9]
      });
    }
  }

  return { count: pending.length, details: pending };
}

// Mark mail as sent
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

// Mark complaint as replied
function updateRepliedStatus(ackNo, mode) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Data");
  const data = sheet.getDataRange().getValues();

  // Mapping mode to correct column number (1-based index)
  const modeColumnMap = {
    "Fault App": 16,
    "Whatsapp": 17,
    "E-mail": 18,
    "Customer Care": 19
  };

  const colIndex = modeColumnMap[mode];
  if (!colIndex) return "❌ Invalid mode selected.";

  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString() === ackNo.toString()) {
      const currentValue = sheet.getRange(i + 1, colIndex).getValue();
      if (currentValue === "Raised") {
        sheet.getRange(i + 1, colIndex).setValue("Replied");
        return "✅ Replied updated for Ack No: " + ackNo + " under mode: " + mode;
      } else {
        return "ℹ️ Mode is not 'Raised' for Ack No: " + ackNo;
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
      sheet.getRange(i + 1, 13).setValue(closedDate); // Closed Date (M)
      return "✅ Fault closed for Ack No: " + ackNo;
    }
  }
  return "❌ Ack No not found.";
}
