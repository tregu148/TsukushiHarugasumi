var scriptProperties = PropertiesService.getScriptProperties();
const DIFY_API_KEY = scriptProperties.getProperty('difyApiKey');
const DIFY_API_URL = scriptProperties.getProperty('DIFY_API_URL');
const URL_LINE_MESSAGE = 'https://api.line.me/v2/bot/message/reply';
const LINEBOT_CONFIG = retrieveLineBotProperty(scriptProperties.getProperty('linebotName'));
const SHEET_USER = SpreadsheetApp.openById(LINEBOT_CONFIG.sheetId).getSheetByName("databaseDify");
const LIMIT_DAILY = 30;
const MESSAGE_LIMIT_DAILY = "一日の上限回数に達しました。また明日話しかけてください。春霞つくしもあなたのお気持ち聞きますよ。https://chat.openai.com/g/g-l1cAnHy7S-chun-xia-tukusi-tsukushi-harugasumi"

function retrieveLineBotProperty(name){
  var sheet = SpreadsheetApp.openById(scriptProperties.getProperty('spreadSheetLinebot')).getSheetByName("linebot");
  var range = sheet.getDataRange();
  var values = range.getValues();
  var jsonLinebot = {
    'name': '',
    'assistantId': '',
    'channelAccessToken': '',
    'sheetId': '',
  };
  var nameCol = -1;
  var appIdCol = -1;
  var channelAccessTokenCol = -1;
  var sheetIdCol = -1;

  var headerRow = values[0];
  for (var col = 0; col < headerRow.length; col++) {
    if (headerRow[col] === 'name') {
      nameCol = col;
    }
    if (headerRow[col] === 'assistantId') {
      appIdCol = col;
    }
    if (headerRow[col] === 'channelAccessToken') {
      channelAccessTokenCol = col;
    }
    if (headerRow[col] === 'sheetId') {
      sheetIdCol = col;
    }
  }

  if (nameCol === -1 || appIdCol === -1 || channelAccessTokenCol === -1|| sheetIdCol === -1) {
    throw new Error('列が見つかりませんでした。');
  }

  for (var row = 1; row < values.length; row++) {
    if (values[row][nameCol] === name) {
      jsonLinebot['name'] = values[row][nameCol];
      jsonLinebot['assistantId'] = values[row][appIdCol];
      jsonLinebot['channelAccessToken'] = values[row][channelAccessTokenCol];
      jsonLinebot['sheetId'] = values[row][sheetIdCol];
      return jsonLinebot;
    }
  }

  return jsonLinebot;
}

function doPost(e) {
  const event = parseEvent(e);
  const replyToken = event.replyToken;
  var messageObj = event.message  
  var userMessage = "";
  const messageType = messageObj.type;
  switch(messageType){
    case "text":
      userMessage = messageObj.text;
      break;
    case "sticker":
      if(messageObj.keywords === undefined){
        userMessage = "？？？";
      } else{
        userMessage = messageObj.keywords.join(",");
      }
      break;
  } 
  const userId = event.source.userId;

  try {
    if (shouldStopProcessing(replyToken,userId,userMessage)) {
      return buildTextOutput('post ok');
    }
    var processedMessage = userMessage;
    
    var message = handleMainResponse(userId, processedMessage, replyToken);
    postLineMessage(replyToken, message);
    return buildTextOutput('post ok');
  } catch (error) {
    handleErrors(userId, error, replyToken, userMessage);
    return buildTextOutput('post ok');
  }
}

function parseEvent(e) {
  return JSON.parse(e.postData.contents).events[0];
}

function shouldStopProcessing(replyToken,userId, userMessage) {
  var boo = false;
  var user0 = retrieveUser(userId);
  if(userMessage.includes('忘れて')) {
    user0['conversationId'] = "";
    modifyUser(user0);
    postLineMessage(replyToken,"---忘却完了---");
    boo = true;
  }
  if(userMessage.includes('github')) {
    postLineMessage(replyToken,"プロンプトとソースはこちら↓ \n\n https://github.com/tregu148/TsukushiHarugasumi \n\n MITライセンスなので、コピペ可");
    boo = true;
  }
  if(!user0.master && user0.responseCount >= LIMIT_DAILY){
    postLineMessage(replyToken,MESSAGE_LIMIT_DAILY);
    boo= true;
  } 
  return boo;
}
function handleMainResponse(userId, processedMessage, replyToken) {
  sendLoadingMessage(userId);
  var user0 = retrieveUser(userId);
  // Logger.log(user0);
  var result = sendChatMessage(processedMessage,user0['conversationId'],user0['userId']);
  // Logger.log(result);
  countupResponseCount(user0);
  return String(result);
}
function aaaiii(){
  var message = handleMainResponse("Ucef27c681b0478ba229d8a10d81a303d",'ぼくのなまえは？','aaa')
  Logger.log(message);
}

function bbb(){

  
  var options = {
    'method': 'get',
    'headers': {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + DIFY_API_KEY
    },
  };
  try {
    var response = UrlFetchApp.fetch(DIFY_API_URL + "/parameters?user=d7adf133-0e6f-4188-a8b6-8dcd9ef92317", options);
    var result = JSON.parse(response.getContentText());
    Logger.log(result);
    return result;
  } catch (e) {
    Logger.log(e.toString());
    logMessage(arguments.callee.name,e.toString())
    throw e;
  }
}

function ccc() {
  var options = {
    'method': 'post',
    'headers': {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + DIFY_API_KEY
    },
    'payload': JSON.stringify({
      'inputs': {},
      'query': 'Hello how are you?',
      'response_mode': 'streaming',
      'user': 'abc-123',
      'conversation_id': ''
    }),
    'muteHttpExceptions': true
  };

  Logger.log(options);

  try {
    var response = UrlFetchApp.fetch(DIFY_API_URL+"/chat-messages", options);
    Logger.log(response);
    var result = JSON.parse(response.getContentText());
    Logger.log(result);
    return result;
  } catch (e) {
    Logger.log(e.toString());
    logMessage(arguments.callee.name, e.toString());
    // Handle the error or return an appropriate message
    return { error: 'An error occurred while processing the request.' };
  }
}

function sendChatMessage(userMessage,conversation_id,user_id) {
  var options = {
    'method': 'post',
    'headers': {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + DIFY_API_KEY
    },
    'payload': JSON.stringify({
      'inputs': {},
      'query': userMessage,
      'response_mode': 'streaming',
      'user': user_id,
      'conversation_id': conversation_id
    }),
    'muteHttpExceptions': true
  };


  try {
    var response = UrlFetchApp.fetch(DIFY_API_URL + "/chat-messages", options);
    var result = "";
    var lines = response.getContentText().split("\n");

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line.startsWith("data: ")) {
        var data = JSON.parse(line.substring(6));
        if (data.event === "agent_message") {
          result += data.answer;
        } else if (data.event === "message_end") {
          // レスポンスからconversation_idを取得
          var conversation_id = data.conversation_id;
          // ユーザーのconversationIdを更新
          var user0 = retrieveUser(user_id);
          user0['conversationId'] = conversation_id;
          modifyUser(user0);
          return result;
        } else if (data.event === "error") {
          // Logger.log(data);
          return result + data.event + String(data);
        }
      }
    }
    var json = JSON.parse(response)
    // Logger.log(json.code)
    if(json.code = "not_found"){
      return json.message
    }
  } catch (e) {
    Logger.log(e.toString());
    logMessage(arguments.callee.name, e.toString());
    return { error: 'An error occurred while processing the request.' };
  }
}


function handleErrors(userId, error, replyToken, userMessage) {
  try {
    if(error.message.includes('conversation_not_found')){
      var user0 = retrieveUser(userId);
      user0['conversationId'] = "";
      modifyUser(user0);
    }
    var message = userMessage + "\n\n---\n\n" + error.message + "\n\n---\n\n もう一度送信していただけますか？";
    message += "\n\n 現在改修中です。その間、以下も　http://dify-2r9mn-u16998.vm.elestio.app/chat/SPSLnYfLNzBNa9ZA"
    logMessage('error',message);
    postApologyAndQuickReplyToLine(replyToken,message,userMessage);
  } catch (e) {
    logMessage('error',e.message);
    postLineMessage(replyToken, e.message);
  }
}

function buildTextOutput(content) {
  return ContentService.createTextOutput(JSON.stringify({ 'content': content }))
    .setMimeType(ContentService.MimeType.JSON);
}

function postLineMessage(replyToken, messageText) {
  if (messageText === null) {
    const errorMessage = "messageText cannot be null";
    console.error(errorMessage);
    messageText = errorMessage;
  }

  // if (typeof messageText !== 'string') {
  //   const errorMessage = "messageText must be a string";
  //   console.error(errorMessage);
  //   messageText = errorMessage;
  // }

  UrlFetchApp.fetch(URL_LINE_MESSAGE, {
    'headers': {
      'Content-Type': 'application/json; charset=UTF-8',
      'Authorization': 'Bearer ' + LINEBOT_CONFIG.channelAccessToken,
    },
    'method': 'post',
    'payload': JSON.stringify({
      'replyToken': replyToken,
      'messages': [{
        'type': 'text',
        'text': messageText
      }]
    })
  });
}

function postApologyAndQuickReplyToLine(replyToken,apologyMessage,userMessage){
  let lineMessage = "lineMessage";
  let quickReplyMessage = "quickReplyMessage";
  if (apologyMessage === null) {
    throw new Error('apologyMessage is null');
  }else if(typeof apologyMessage !== 'string'){
    throw new Error('Invalid type for apologyMessage: ' + typeof apologyMessage);
  }else {
    lineMessage = apologyMessage;
  }

  if (userMessage === null) {
    throw new Error('userMessage is null');
  }else if(typeof userMessage !== 'string'){
    throw new Error('Invalid type for userMessage: ' + typeof userMessage);
  }else {
    quickReplyMessage = userMessage;
  }

  UrlFetchApp.fetch(URL_LINE_MESSAGE, {
    'headers': {
      'Content-Type': 'application/json; charset=UTF-8',
      'Authorization': 'Bearer ' + LINEBOT_CONFIG.channelAccessToken,
    },
    'method': 'post',
    'payload': JSON.stringify({
      'replyToken': replyToken,
      'messages': [{
        'type': 'text',
        'text': lineMessage,
        'quickReply':{
          'items':[{
            'type':'action',
            'action':{
              'type': 'message',
              'label':'もう一度送る',
              'text': quickReplyMessage
            }
          }]
        }
      }]
    })
  });
}

function logMessage(userId,message){
  var sheetLogger = SpreadsheetApp.openById(LINEBOT_CONFIG.sheetId).getSheetByName("logger");
  let lastRow = sheetLogger.getLastRow();
  const newRow = lastRow + 1;

  if(lastRow>=1){
    sheetLogger.insertRowAfter(lastRow);
  }
  
  const range = sheetLogger.getRange(newRow, 1);
  range.setValue(getCurrentDateTime());
  range.offset(0, 1).setValue(LINEBOT_CONFIG.name);
  range.offset(0, 2).setValue(userId);
  range.offset(0, 3).setValue(message);
 
}

function getCurrentDateTime() {
  var now = new Date();
  var year = now.getFullYear();
  var month = ("0" + (now.getMonth() + 1)).slice(-2);
  var day = ("0" + now.getDate()).slice(-2);
  var hours = ("0" + now.getHours()).slice(-2);
  var minutes = ("0" + now.getMinutes()).slice(-2);

  var formattedDateTime = year + "/" + month + "/" + day + " " + hours + ":" + minutes;
  return formattedDateTime;
}

function retrieveUser(userId) {
  var sheet = SHEET_USER;
  var range = sheet.getDataRange();
  var values = range.getValues();
  var jsonUser = {
    'userId': '',
    'conversationId': '',
    'responseCount': 0,
    'row': 0,
    'master':false,
  };
  
  var userIdCol = -1;
  var responseCountCol = -1; 
  var conversationIdCol = -1;
  
  var headerRow = values[0];
  for (var col = 0; col < headerRow.length; col++) {
    if (headerRow[col] === 'userId') {
      userIdCol = col;
    }
    if (headerRow[col] === 'conversationId') {
      conversationIdCol = col;
    }  
    if (headerRow[col] === 'responseCount') {
      responseCountCol = col;
    }
  }
  Logger.log(values)
  if (userIdCol === -1 || responseCountCol === -1 || conversationIdCol === -1) {
    throw new Error('userId または responseCount または conversationId の列が見つかりませんでした。');
  }
  
  for (var row = 1; row < values.length; row++) {
    if (values[row][userIdCol] === userId) {
      jsonUser['userId'] = values[row][userIdCol];  
      jsonUser['conversationId'] = values[row][conversationIdCol];
      jsonUser['responseCount'] = values[row][responseCountCol];
      jsonUser['master'] = values[row][responseCountCol+1];
      jsonUser['row'] = row + 1
      return jsonUser;
    }
  }
   // ユーザーIDが見つからない場合、新しいユーザーを作成
  var newRow = values.length + 1;
  SHEET_USER.getRange(newRow, userIdCol + 1).setValue(userId);
  SHEET_USER.getRange(newRow, conversationIdCol + 1).setValue("");
  SHEET_USER.getRange(newRow, responseCountCol + 1).setValue(0);
  SHEET_USER.getRange(newRow, responseCountCol + 2).setValue(false);

  jsonUser['userId'] = userId;
  jsonUser['conversationId'] = "";
  jsonUser['responseCount'] = 0;
  jsonUser['master'] = false;
  jsonUser['row'] = newRow;

  return jsonUser;
}

function countupResponseCount(user) {
  const range = SHEET_USER.getRange(user['row'], 1);
  if( user['row'] > 1){
    range.offset(0, 2).setValue(user['responseCount'] + 1);
  }
  return;
}

function modifyUser(jsonUser){
  const range = SHEET_USER.getRange(jsonUser.row,1);
  if(jsonUser.row>1){
  range.offset(0,1).setValue(jsonUser.conversationId);
  }
  return;
}

function extractIds(inputString) {
  var threadPattern = /thread_([A-Za-z0-9]+)/;
  var runPattern = /run_([A-Za-z0-9]+)/;
  var threadMatch = inputString.match(threadPattern);
  var runMatch = inputString.match(runPattern);
  var threadId = threadMatch ? threadMatch[1] : null;
  var runId = runMatch ? runMatch[1] : null;
  console.log("Thread ID:", threadId);
  console.log("Run ID:", runId);
  var id = {
    'threadId':threadId,
    'runId':runId,
  }
  return id
}

function sendLoadingMessage(userId) {
 var url = 'https://api.line.me/v2/bot/chat/loading/start';
 var headers = {
   'Content-Type': 'application/json',
   'Authorization': 'Bearer '+ LINEBOT_CONFIG.channelAccessToken 
 };
 var data = {
   'chatId': userId,
   'loadingSeconds': 5
 };
 var options = {
   'method': 'post',
   'headers': headers,
   'payload': JSON.stringify(data)
 };
 
 var response = UrlFetchApp.fetch(url, options);
 return response;
}
function resetResponseCountColumn() {
  var sheet = SHEET_USER;

  // ResponseCount 列のインデックスを取得
  var responseCountColIndex = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].indexOf('responseCount');

  // ResponseCount 列が見つからない場合はエラーを投げる
  if (responseCountColIndex === -1) {
    throw new Error('ResponseCount 列が見つかりませんでした。');
  }

  // ResponseCount 列の値をすべて 0 にリセット
  var responseCountRange = sheet.getRange(2, responseCountColIndex + 1, sheet.getLastRow() - 1, 1);
  responseCountRange.setValue(0);
}
function testRetrieveLineBotProperty() {
  try {
    const property = retrieveLineBotProperty('春霞つくし');
    console.log('retrieveLineBotProperty test passed');
    console.log('Retrieved property:', property);
  } catch (error) {
    console.error('retrieveLineBotProperty test failed');
    console.error('Error:', error);
  }
}

function testShouldStopProcessing() {
  try {
    const testCases = [
      { replyToken: 'testReplyToken1', userId: 'Ucef27c681b0478ba229d8a10d81a303d', userMessage: '忘れて', expected: true },
      { replyToken: 'testReplyToken2', userId: 'Ucef27c681b0478ba229d8a10d81a303d', userMessage: 'こんにちは', expected: false },
    ];

    for (const testCase of testCases) {
      const result = shouldStopProcessing(testCase.replyToken, testCase.userId, testCase.userMessage);
      console.log('shouldStopProcessing test case:', testCase, 'Result:', result);
      if (result !== testCase.expected) {
        throw new Error('shouldStopProcessing test failed');
      }
    }
    console.log('shouldStopProcessing test passed');
  } catch (error) {
    console.error('shouldStopProcessing test failed');
    console.error('Error:', error);
  }
}

function testSendChatMessage() {
  try {
    const testConversationId = '';
    const testUserMessage = 'ぼくのことおぼえてる？';
    const testUserId = 'abc-123';

    const result = sendChatMessage(testUserMessage,testConversationId, testUserId);
    console.log('sendChatMessage test passed');
    console.log('Result:', result);
  } catch (error) {
    console.error('sendChatMessage test failed');
    console.error('Error:', error);
  }
}

function testRetrieveUser() {
  try {
    const testUserId = 'testUserId';
    const user = retrieveUser(testUserId);
    console.log('retrieveUser test passed');
    console.log('Retrieved user:', user);
  } catch (error) {
    console.error('retrieveUser test failed');
    console.error('Error:', error);
  }
}

function testAll() {
  testRetrieveLineBotProperty();
  testShouldStopProcessing();
  testSendChatMessage();
  testRetrieveUser();
}
