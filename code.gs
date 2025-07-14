// Serve the web app with routing
function doGet(e) {
  const page = e && e.parameter && e.parameter.page;
  switch (page) {
    case "complaint":  return HtmlService.createHtmlOutputFromFile("Index");
    case "mail":       return HtmlService.createHtmlOutputFromFile("MailSent");
    case "replied":    return HtmlService.createHtmlOutputFromFile("Replied");
    case "closefault": return HtmlService.createHtmlOutputFromFile("CloseFault");
    case "dashboard":  return HtmlService.createHtmlOutputFromFile("Dashboard");
    default:           return HtmlService.createHtmlOutputFromFile("Login");
  }
}

// Login check
function checkLogin(username, password) {
  return (username==="admin" && password==="admin123") ? "success" : "fail";
}

// Return form HTMLs
function getComplaintForm()  { return HtmlService.createHtmlOutputFromFile("Index").getContent(); }
function getMailSentForm()   { return HtmlService.createHtmlOutputFromFile("MailSent").getContent(); }
function getRepliedForm()    { return HtmlService.createHtmlOutputFromFile("Replied").getContent(); }
function getCloseFaultForm() { return HtmlService.createHtmlOutputFromFile("CloseFault").getContent(); }
function getLoginForm()      { return HtmlService.createHtmlOutputFromFile("Login").getContent(); }
function getDashboard()      { return HtmlService.createHtmlOutputFromFile("Dashboard").getContent(); }

// Submit complaint (auto-AckNo + mark Raised)
function submitComplaintToSheet(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Data");
  if (!sheet) throw new Error("Sheet 'Data' not found.");

  const lastRow = sheet.getLastRow();
  let nextAck = 1000;
  if (lastRow > 1) {
    const prev = sheet.getRange(lastRow,1).getValue();
    if (!isNaN(prev)) nextAck = Number(prev)+1;
  }

  const row = [
    nextAck, data.date, data.time, data.station, data.mode, data.scm,
    data.name||"", data.mobile||"", data.amount||"", data.type, data.description,
    "", "", "", "", "", "", "", "", ""
  ];
  sheet.getRange(lastRow+1,1,1,row.length).setValues([row]);

  const channels = { "Fault App":17, "Whatsapp":18, "E-mail":19, "Customer Care":20 };
  const col = channels[data.mode];
  if (col) sheet.getRange(lastRow+1, col).setValue("Raised");

  return "✅ Complaint submitted (Ack No: "+nextAck+")";
}

// Mark mail as sent
function markMailSentAndClose(ackNo) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Data");
  const data = sheet.getDataRange().getValues();
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");

  for (let i=1; i<data.length; i++) {
    if (data[i][0].toString() === String(ackNo)) {
      sheet.getRange(i+1,15).setValue(today);   // O
      sheet.getRange(i+1,16).setValue("Sent");  // P
      return "✅ Mail sent for Ack No: "+ackNo;
    }
  }
  return "❌ Ack No not found.";
}

// Return pending faults (Ack Nos)
function getPendingFaults() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Data");
  const data = sheet.getDataRange().getValues();
  const pending = [];

  for (let i=1; i<data.length; i++) {
    const status = data[i][12]; // M
    const ackNo  = data[i][0];  // A
    if (!status || status.toString().trim() !== "Closed") {
      pending.push(ackNo);
    }
  }
  return pending;
}

// Return pending replies (Ack No + Mode combinations)
function getPendingReplies() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Data");
  const data = sheet.getDataRange().getValues();
  const pendingReplies = [];
  const modes = {16: "Fault App", 17: "Whatsapp", 18: "E-mail", 19: "Customer Care"};

  for (let i=1; i<data.length; i++) {
    const ackNo = data[i][0];
    Object.keys(modes).forEach(col => {
      if (data[i][col] === "Raised") {
        pendingReplies.push(ackNo + " | " + modes[col]);
      }
    });
  }
  return pendingReplies;
}

// Mark complaint as replied
function updateRepliedStatus(combined) {
  const [ackNo, mode] = combined.split(" | ");
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Data");
  const data = sheet.getDataRange().getValues();
  const map = { "Fault App":17, "Whatsapp":18, "E-mail":19, "Customer Care":20 };
  const col = map[mode];
  if (!col) return "❌ Invalid mode.";

  for (let i=1; i<data.length; i++) {
    if (data[i][0].toString() === String(ackNo)) {
      const cell = sheet.getRange(i+1,col).getValue();
      if (cell==="Raised") {
        sheet.getRange(i+1,col).setValue("Replied");
        return "✅ Marked Replied (Ack No: "+ackNo+", "+mode+")";
      } else {
        return "ℹ️ No Raised under "+mode+" for Ack No: "+ackNo;
      }
    }
  }
  return "❌ Ack No not found.";
}

// Close fault
function closeFault(ackNo, closedDate) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Data");
  const data = sheet.getDataRange().getValues();

  for (let i=1; i<data.length; i++) {
    if (data[i][0].toString() === String(ackNo)) {
      sheet.getRange(i+1,13).setValue("Closed");   // M
      sheet.getRange(i+1,14).setValue(closedDate); // N
      return "✅ Closed fault Ack No: "+ackNo;
    }
  }
  return "❌ Ack No not found.";
}

// Dashboard summary
function getDashboardSummary() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Data");
  const data = sheet.getDataRange().getValues();

  const pendingFaults   = {count:0, ackNos:[]};
  const unsentEmails    = {count:0, ackNos:[]};
  const pendingReplies  = {count:0, ackNos:[]};
  
  for (let i=1; i<data.length; i++) {
    const row = data[i], ack = row[0];
    if (!row[12] || row[12]!=="Closed") {
      pendingFaults.count++; pendingFaults.ackNos.push(ack);
    }
    if (!row[15]) {
      unsentEmails.count++; unsentEmails.ackNos.push(ack);
    }
  }

  // Use getPendingReplies() directly for full Ack No + Mode display
  const replies = getPendingReplies();
  pendingReplies.count = replies.length;
  pendingReplies.ackNos = replies;

  return { pendingFaults, unsentEmails, pendingReplies };
}

// Get complaint details by Ack No (MailSent auto-fill)
function getComplaintDetails(ackNo) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Data");
  const data = sheet.getDataRange().getValues();

  for (let i=1; i<data.length; i++) {
    if (data[i][0].toString() === String(ackNo)) {
      return {
        scm: data[i][5] || "",
        mobile: data[i][7] || "",
        amount: data[i][8] || "",
        type: data[i][9] || "",
        description: data[i][10] || ""
      };
    }
  }
  return null;
}
