const APP = {
  SESSION_DAYS: 90,
  SHEETS: {
    USERS: 'Users',
    DIARIES: 'Diaries',
    COMMENTS: 'Comments',
    NOTIFICATIONS: 'Notifications',
    SESSIONS: 'Sessions'
  },
  HEADERS: {
    Users: ['userId','password','passwordHash','name','active','createdAt'],
    Diaries: ['diaryId','userId','name','title','status','contentJson','createdAt','updatedAt','publishedAt'],
    Comments: ['commentId','diaryId','userId','name','body','createdAt','deleted'],
    Notifications: ['notificationId','userId','type','diaryId','commentId','fromUserId','message','createdAt','read'],
    Sessions: ['token','userId','createdAt','expiresAt']
  }
};

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('みんなの日記')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover');
}

/* =========================================================
   初期設定
   Code.gs を置き換えたあと、スプレッドシート側から1回実行してください。
   ========================================================= */
function setup() {
  return withLock_(function () {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      throw new Error('対象スプレッドシートから「拡張機能 → Apps Script」を開いて setup() を実行してください。');
    }

    PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());

    migrateUsers_(ss);
    migrateDiaries_(ss);
    migrateDrafts_(ss);
    migrateComments_(ss);
    migrateNotifications_(ss);
    migrateSessions_(ss);
    cleanExpiredSessions_();

    return 'セットアップ完了';
  });
}

/* =========================================================
   シート移行
   ========================================================= */
function migrateUsers_(ss) {
  const name = APP.SHEETS.USERS;
  const sh = ss.getSheetByName(name);

  if (!sh || sh.getLastRow() === 0) {
    ensureSheet_(ss, name, APP.HEADERS.Users);
    return;
  }

  const data = sh.getDataRange().getValues();
  const map = indexMap_(data[0]);
  const out = [];

  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    const userId = String(valueByAny_(r, map, ['userId','id','ユーザーID']) || '').trim();
    if (!userId) continue;

    const rawPlain = valueByAny_(r, map, ['password','pass','pwd','pw','パスワード']);
    let plainPassword = '';

    if (rawPlain !== '' && rawPlain != null) {
      const candidate = String(rawPlain);
      // 古いシートで password 列にハッシュが入っていた場合は平文として扱わない
      if (!/^[0-9a-f]{64}$/i.test(candidate) && candidate.indexOf('v2$') !== 0) {
        plainPassword = candidate;
      }
    }

    let passwordHash = String(valueByAny_(r, map, ['passwordHash','password_hash']) || '');

    // 旧形式でハッシュが password 列に入っている場合を救済
    if (!passwordHash && rawPlain !== '' && rawPlain != null) {
      const candidate = String(rawPlain);
      if (/^[0-9a-f]{64}$/i.test(candidate) || candidate.indexOf('v2$') === 0) {
        passwordHash = candidate;
      }
    }

    if (!passwordHash && plainPassword) {
      passwordHash = makePasswordHash_(plainPassword);
    }

    const displayName = String(valueByAny_(r, map, ['name','displayName','表示名']) || userId).trim() || userId;
    const activeValue = valueByAny_(r, map, ['active','enabled','有効']);
    const createdAt = valueByAny_(r, map, ['createdAt','created','作成日時']) || new Date();

    out.push([
      userId,
      plainPassword,
      passwordHash,
      displayName,
      toBool_(activeValue, true),
      createdAt
    ]);
  }

  rewriteSheet_(sh, APP.HEADERS.Users, out);
}

function migrateDiaries_(ss) {
  const name = APP.SHEETS.DIARIES;
  const sh = ss.getSheetByName(name);

  if (!sh || sh.getLastRow() === 0) {
    ensureSheet_(ss, name, APP.HEADERS.Diaries);
    return;
  }

  const data = sh.getDataRange().getValues();
  const map = indexMap_(data[0]);
  const out = [];

  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    const diaryId = String(valueByAny_(r, map, ['diaryId','id']) || createId_('diary'));
    const userId = String(valueByAny_(r, map, ['userId','authorId']) || '').trim();
    if (!userId) continue;

    const user = userByIdRaw_(ss, userId);
    const displayName = String(valueByAny_(r, map, ['name','authorName']) || (user ? user.name : userId));
    const title = String(valueByAny_(r, map, ['title','subject']) || '');
    const rawStatus = String(valueByAny_(r, map, ['status']) || 'published').toLowerCase();
    const status = rawStatus === 'draft' ? 'draft' : 'published';

    let contentJson = valueByAny_(r, map, ['contentJson','content_json']);

    if (!contentJson) {
      const body = String(valueByAny_(r, map, ['body','content','text']) || '');
      contentJson = JSON.stringify([{type:'text', text:body}]);
    } else if (typeof contentJson !== 'string') {
      contentJson = JSON.stringify(contentJson);
    }

    // 添付ファイルは使わない方針なので、文章ブロックだけ残す
    contentJson = JSON.stringify(textBlocksOnly_(contentJson));

    const createdAt = valueByAny_(r, map, ['createdAt','created']) || new Date();
    const updatedAt = valueByAny_(r, map, ['updatedAt','updated']) || createdAt;
    const publishedAt = status === 'published'
      ? (valueByAny_(r, map, ['publishedAt','published']) || createdAt)
      : '';

    out.push([
      diaryId,
      userId,
      displayName,
      title,
      status,
      contentJson,
      createdAt,
      updatedAt,
      publishedAt
    ]);
  }

  rewriteSheet_(sh, APP.HEADERS.Diaries, out);
}

function migrateDrafts_(ss) {
  const old = ss.getSheetByName('Drafts');
  if (!old || old.getLastRow() < 2) return;

  const data = old.getDataRange().getValues();
  const map = indexMap_(data[0]);
  const diarySheet = sheet_(APP.SHEETS.DIARIES);
  const existing = new Set(rows_(APP.SHEETS.DIARIES).map(function (r) {
    return String(r.diaryId);
  }));

  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    const diaryId = String(valueByAny_(r, map, ['draftId','diaryId','id']) || createId_('draft'));
    if (existing.has(diaryId)) continue;

    const userId = String(valueByAny_(r, map, ['userId','authorId']) || '').trim();
    if (!userId) continue;

    const user = getUserById_(userId);
    const title = String(valueByAny_(r, map, ['title','subject']) || '');
    const body = String(valueByAny_(r, map, ['body','content','text']) || '');
    const createdAt = valueByAny_(r, map, ['createdAt','created']) || new Date();
    const updatedAt = valueByAny_(r, map, ['updatedAt','updated']) || createdAt;

    diarySheet.appendRow([
      diaryId,
      userId,
      user ? String(user.name || userId) : userId,
      title,
      'draft',
      JSON.stringify([{type:'text', text:body}]),
      createdAt,
      updatedAt,
      ''
    ]);

    existing.add(diaryId);
  }
}

function migrateComments_(ss) {
  const name = APP.SHEETS.COMMENTS;
  const sh = ss.getSheetByName(name);

  if (!sh || sh.getLastRow() === 0) {
    ensureSheet_(ss, name, APP.HEADERS.Comments);
    return;
  }

  const data = sh.getDataRange().getValues();
  const map = indexMap_(data[0]);
  const out = [];

  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    const diaryId = String(valueByAny_(r, map, ['diaryId']) || '');
    const userId = String(valueByAny_(r, map, ['userId']) || '');
    if (!diaryId || !userId) continue;

    const user = getUserById_(userId);

    out.push([
      String(valueByAny_(r, map, ['commentId','id']) || createId_('comment')),
      diaryId,
      userId,
      String(valueByAny_(r, map, ['name','authorName']) || (user ? user.name : userId)),
      String(valueByAny_(r, map, ['body','text','comment']) || ''),
      valueByAny_(r, map, ['createdAt','created']) || new Date(),
      toBool_(valueByAny_(r, map, ['deleted']), false)
    ]);
  }

  rewriteSheet_(sh, APP.HEADERS.Comments, out);
}

function migrateNotifications_(ss) {
  const name = APP.SHEETS.NOTIFICATIONS;
  const sh = ss.getSheetByName(name);

  if (!sh || sh.getLastRow() === 0) {
    ensureSheet_(ss, name, APP.HEADERS.Notifications);
    return;
  }

  const data = sh.getDataRange().getValues();
  const map = indexMap_(data[0]);
  const out = [];

  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    const userId = String(valueByAny_(r, map, ['userId']) || '');
    if (!userId) continue;

    out.push([
      String(valueByAny_(r, map, ['notificationId','id']) || createId_('notification')),
      userId,
      String(valueByAny_(r, map, ['type']) || 'comment'),
      String(valueByAny_(r, map, ['diaryId']) || ''),
      String(valueByAny_(r, map, ['commentId']) || ''),
      String(valueByAny_(r, map, ['fromUserId']) || ''),
      String(valueByAny_(r, map, ['message']) || ''),
      valueByAny_(r, map, ['createdAt','created']) || new Date(),
      toBool_(valueByAny_(r, map, ['read']), false)
    ]);
  }

  rewriteSheet_(sh, APP.HEADERS.Notifications, out);
}

function migrateSessions_(ss) {
  const name = APP.SHEETS.SESSIONS;
  const sh = ss.getSheetByName(name);

  if (!sh || sh.getLastRow() === 0) {
    ensureSheet_(ss, name, APP.HEADERS.Sessions);
    return;
  }

  const data = sh.getDataRange().getValues();
  const map = indexMap_(data[0]);
  const out = [];

  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    const token = String(valueByAny_(r, map, ['token']) || '');
    const userId = String(valueByAny_(r, map, ['userId']) || '');
    if (!token || !userId) continue;

    const createdAt = valueByAny_(r, map, ['createdAt','created']) || new Date();

    // setup() 実行時、既存セッションも現在時刻から90日へ延長する
    // 端末に保存済みのトークンをそのまま使い続けられるようにする
    const expiresAt = new Date(Date.now() + APP.SESSION_DAYS * 86400000);

    out.push([token, userId, createdAt, expiresAt]);
  }

  rewriteSheet_(sh, APP.HEADERS.Sessions, out);
}

/* =========================================================
   共通シート処理
   ========================================================= */
function getSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('先に setup() を実行してください。');
  return SpreadsheetApp.openById(id);
}

function sheet_(name) {
  const sh = getSpreadsheet_().getSheetByName(name);
  if (!sh) throw new Error('シート「' + name + '」がありません。setup() を実行してください。');
  return sh;
}

function ensureSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);

  sh.clearContents();
  sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  sh.setFrozenRows(1);
  return sh;
}

function rewriteSheet_(sh, headers, dataRows) {
  sh.clearContents();
  sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (dataRows.length) {
    sh.getRange(2, 1, dataRows.length, headers.length).setValues(dataRows);
  }
  sh.setFrozenRows(1);
}

function indexMap_(headers) {
  const map = {};
  headers.forEach(function (h, i) {
    map[String(h || '').trim()] = i;
  });
  return map;
}

function valueByAny_(row, map, names) {
  for (let i = 0; i < names.length; i++) {
    if (Object.prototype.hasOwnProperty.call(map, names[i])) {
      return row[map[names[i]]];
    }
  }
  return '';
}

function rows_(name) {
  const sh = sheet_(name);
  const lastRow = sh.getLastRow();
  const lastColumn = sh.getLastColumn();
  if (lastRow < 2 || lastColumn < 1) return [];

  const values = sh.getRange(1, 1, lastRow, lastColumn).getValues();
  const headers = values[0].map(function (h) { return String(h || '').trim(); });

  return values.slice(1).map(function (row, index) {
    const obj = {_row:index + 2};
    headers.forEach(function (h, col) {
      if (h) obj[h] = row[col];
    });
    return obj;
  });
}

function deleteRowsWhere_(sheetName, predicate) {
  const sh = sheet_(sheetName);
  rows_(sheetName)
    .filter(predicate)
    .sort(function (a, b) { return b._row - a._row; })
    .forEach(function (r) { sh.deleteRow(r._row); });
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function toBool_(value, fallback) {
  if (value === true || value === false) return value;
  const s = String(value == null ? '' : value).trim().toLowerCase();
  if (['true','1','yes','y','on','有効'].includes(s)) return true;
  if (['false','0','no','n','off','無効'].includes(s)) return false;
  return fallback;
}

function createId_(prefix) {
  return prefix + '_' + Utilities.getUuid().replace(/-/g, '');
}

function iso_(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? String(value) : d.toISOString();
}

function textBlocksOnly_(value) {
  let content = [];

  try {
    content = Array.isArray(value) ? value : JSON.parse(String(value || '[]'));
  } catch (e) {
    return [{type:'text', text:String(value || '')}];
  }

  if (!Array.isArray(content)) return [];

  return content
    .filter(function (b) { return b && String(b.type) === 'text'; })
    .map(function (b) { return {type:'text', text:String(b.text || '')}; });
}

function bodyFromContentJson_(value) {
  return textBlocksOnly_(value)
    .map(function (b) { return String(b.text || ''); })
    .join('\n');
}

function userByIdRaw_(ss, userId) {
  const sh = ss.getSheetByName(APP.SHEETS.USERS);
  if (!sh || sh.getLastRow() < 2) return null;

  const data = sh.getDataRange().getValues();
  const map = indexMap_(data[0]);
  const target = String(userId || '').trim().toLowerCase();

  for (let i = 1; i < data.length; i++) {
    const id = String(valueByAny_(data[i], map, ['userId','id','ユーザーID']) || '').trim();
    if (id.toLowerCase() === target) {
      return {
        userId:id,
        name:String(valueByAny_(data[i], map, ['name','displayName','表示名']) || id)
      };
    }
  }

  return null;
}

/* =========================================================
   パスワード
   ========================================================= */
function makePasswordHash_(password) {
  const salt = Utilities.getUuid().replace(/-/g, '');
  const hash = hashText_(salt + '|' + String(password || ''));
  return 'v2$' + salt + '$' + hash;
}

function hashText_(text) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(text || ''),
    Utilities.Charset.UTF_8
  );

  return bytes.map(function (b) {
    const v = (b + 256) % 256;
    return ('0' + v.toString(16)).slice(-2);
  }).join('');
}

function verifyPassword_(stored, password) {
  stored = String(stored || '');
  password = String(password || '');

  if (stored.indexOf('v2$') === 0) {
    const parts = stored.split('$');
    if (parts.length !== 3) return false;
    return hashText_(parts[1] + '|' + password) === parts[2];
  }

  // 旧64桁SHA-256形式
  if (/^[0-9a-f]{64}$/i.test(stored)) {
    return hashText_(password).toLowerCase() === stored.toLowerCase();
  }

  // さらに古い平文形式
  return stored !== '' && stored === password;
}

/* =========================================================
   ユーザー / ログイン
   ========================================================= */
function getUserById_(userId) {
  const target = String(userId || '').trim().toLowerCase();
  return rows_(APP.SHEETS.USERS).find(function (r) {
    return String(r.userId || '').trim().toLowerCase() === target;
  }) || null;
}

function registerUser(userId, password, name) {
  return withLock_(function () {
    userId = String(userId || '').trim();
    password = String(password || '');
    name = String(name || '').trim();

    if (!/^[A-Za-z0-9_-]{3,30}$/.test(userId)) {
      throw new Error('IDは英数字・_・-の3〜30文字で入力してください。');
    }

    if (password.length < 6 || password.length > 100) {
      throw new Error('パスワードは6〜100文字で入力してください。');
    }

    if (!name || name.length > 40) {
      throw new Error('表示名は1〜40文字で入力してください。');
    }

    const duplicate = rows_(APP.SHEETS.USERS).some(function (r) {
      return String(r.userId || '').toLowerCase() === userId.toLowerCase();
    });

    if (duplicate) throw new Error('そのIDはすでに使われています。');

    sheet_(APP.SHEETS.USERS).appendRow([
      userId,
      password,
      makePasswordHash_(password),
      name,
      true,
      new Date()
    ]);

    return {success:true};
  });
}

function login(userId, password) {
  return withLock_(function () {
    userId = String(userId || '').trim();
    password = String(password || '');

    const user = getUserById_(userId);

    if (!user || !toBool_(user.active, false) || !verifyPassword_(user.passwordHash, password)) {
      throw new Error('IDまたはパスワードが違います。');
    }

    const userSheet = sheet_(APP.SHEETS.USERS);

    // ログイン成功時に確認用の平文パスワードを保存
    userSheet.getRange(user._row, 2).setValue(password);

    // 古いハッシュ形式なら新形式へ更新
    if (String(user.passwordHash || '').indexOf('v2$') !== 0) {
      userSheet.getRange(user._row, 3).setValue(makePasswordHash_(password));
    }

    cleanExpiredSessions_();

    const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + APP.SESSION_DAYS * 86400000);

    sheet_(APP.SHEETS.SESSIONS).appendRow([
      token,
      String(user.userId),
      now,
      expiresAt
    ]);

    return {
      token:token,
      user:{
        userId:String(user.userId),
        name:String(user.name || user.userId)
      }
    };
  });
}

function logout(token) {
  return withLock_(function () {
    if (!token) return true;

    deleteRowsWhere_(APP.SHEETS.SESSIONS, function (r) {
      return String(r.token) === String(token);
    });

    return true;
  });
}

function cleanExpiredSessions_() {
  const now = Date.now();
  const sh = sheet_(APP.SHEETS.SESSIONS);

  rows_(APP.SHEETS.SESSIONS)
    .filter(function (r) {
      const t = new Date(r.expiresAt).getTime();
      return !t || t <= now;
    })
    .sort(function (a, b) { return b._row - a._row; })
    .forEach(function (r) { sh.deleteRow(r._row); });
}

function auth_(token) {
  token = String(token || '');
  if (!token) throw new Error('ログインしてください。');

  const session = rows_(APP.SHEETS.SESSIONS).find(function (r) {
    return String(r.token) === token;
  });

  if (!session) throw new Error('ログイン期限が切れています。');

  const expires = new Date(session.expiresAt).getTime();
  if (!expires || expires <= Date.now()) {
    try {
      sheet_(APP.SHEETS.SESSIONS).deleteRow(session._row);
    } catch (e) {}
    throw new Error('ログイン期限が切れています。');
  }

  const user = getUserById_(session.userId);
  if (!user || !toBool_(user.active, false)) {
    throw new Error('このユーザーは利用できません。');
  }

  return user;
}

/* =========================================================
   起動データ
   ========================================================= */
function getBootstrap(token) {
  const user = auth_(token);
  const diaries = listDiariesForUser_(user, 'all', 100);
  const notifications = notificationsForUser_(user);

  return {
    user:{
      userId:String(user.userId),
      name:String(user.name || user.userId)
    },
    diaries:diaries,
    notifications:notifications,
    unread:notifications.filter(function (n) { return !n.read; }).length
  };
}

/* =========================================================
   日記保存
   ========================================================= */
function saveDiary(token, data) {
  return withLock_(function () {
    const user = auth_(token);
    data = data || {};

    const title = String(data.title || '').trim();
    const body = String(data.body || '');
    const status = data.status === 'published' ? 'published' : 'draft';

    if (status === 'published' && !title) {
      throw new Error('タイトルを入力してください。');
    }

    if (title.length > 100) {
      throw new Error('タイトルは100文字以内にしてください。');
    }

    if (body.length > 30000) {
      throw new Error('本文は30,000文字以内にしてください。');
    }

    const diaryId = String(data.diaryId || createId_('diary'));
    const sh = sheet_(APP.SHEETS.DIARIES);

    const existing = rows_(APP.SHEETS.DIARIES).find(function (r) {
      return String(r.diaryId) === diaryId;
    });

    if (existing && String(existing.userId) !== String(user.userId)) {
      throw new Error('編集権限がありません。');
    }

    const contentJson = JSON.stringify([
      {type:'text', text:body}
    ]);

    const now = new Date();

    if (existing) {
      const publishedAt = status === 'published'
        ? (existing.publishedAt || now)
        : '';

      sh.getRange(existing._row, 1, 1, 9).setValues([[
        diaryId,
        String(user.userId),
        String(user.name || user.userId),
        title,
        status,
        contentJson,
        existing.createdAt || now,
        now,
        publishedAt
      ]]);

    } else {
      sh.appendRow([
        diaryId,
        String(user.userId),
        String(user.name || user.userId),
        title,
        status,
        contentJson,
        now,
        now,
        status === 'published' ? now : ''
      ]);
    }

    return getDiaryForUser_(user, diaryId);
  });
}

function getDiary(token, diaryId) {
  const user = auth_(token);
  return getDiaryForUser_(user, diaryId);
}

function getDiaryForUser_(user, diaryId) {
  const diary = rows_(APP.SHEETS.DIARIES).find(function (r) {
    return String(r.diaryId) === String(diaryId);
  });

  if (!diary) throw new Error('日記が見つかりません。');

  if (
    String(diary.status) !== 'published' &&
    String(diary.userId) !== String(user.userId)
  ) {
    throw new Error('この日記は公開されていません。');
  }

  const body = bodyFromContentJson_(diary.contentJson);

  const comments = rows_(APP.SHEETS.COMMENTS)
    .filter(function (c) {
      return String(c.diaryId) === String(diaryId) && !toBool_(c.deleted, false);
    })
    .sort(function (a, b) {
      return new Date(a.createdAt) - new Date(b.createdAt);
    })
    .map(function (c) {
      return {
        commentId:String(c.commentId),
        userId:String(c.userId),
        name:String(c.name || c.userId),
        body:String(c.body || ''),
        createdAt:iso_(c.createdAt),
        own:String(c.userId) === String(user.userId)
      };
    });

  return {
    diaryId:String(diary.diaryId),
    userId:String(diary.userId),
    name:String(diary.name || diary.userId),
    title:String(diary.title || ''),
    status:String(diary.status || 'published'),
    body:body,
    content:[{type:'text', text:body}],
    createdAt:iso_(diary.createdAt),
    updatedAt:iso_(diary.updatedAt),
    publishedAt:diary.publishedAt ? iso_(diary.publishedAt) : '',
    own:String(diary.userId) === String(user.userId),
    comments:comments
  };
}

/* =========================================================
   日記一覧
   ========================================================= */
function listDiaries(token, filter, limit) {
  const user = auth_(token);
  return listDiariesForUser_(user, filter, limit);
}

function listDiariesForUser_(user, filter, limit) {
  filter = String(filter || 'all');
  limit = Math.max(1, Math.min(Number(limit) || 20, 100));

  let list = rows_(APP.SHEETS.DIARIES).filter(function (r) {
    return (
      String(r.status) === 'published' ||
      String(r.userId) === String(user.userId)
    );
  });

  if (filter === 'mine') {
    list = list.filter(function (r) {
      return String(r.userId) === String(user.userId);
    });
  }

  if (filter === 'drafts') {
    list = list.filter(function (r) {
      return (
        String(r.userId) === String(user.userId) &&
        String(r.status) === 'draft'
      );
    });
  }

  return list
    .sort(function (a, b) {
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    })
    .slice(0, limit)
    .map(function (r) {
      return {
        diaryId:String(r.diaryId),
        userId:String(r.userId),
        name:String(r.name || r.userId),
        title:String(r.title || ''),
        status:String(r.status || 'published'),
        createdAt:iso_(r.createdAt),
        updatedAt:iso_(r.updatedAt),
        publishedAt:r.publishedAt ? iso_(r.publishedAt) : '',
        own:String(r.userId) === String(user.userId)
      };
    });
}

function searchDiaries(token, query) {
  const user = auth_(token);
  query = String(query || '').trim().toLowerCase();

  if (!query) return [];

  return rows_(APP.SHEETS.DIARIES)
    .filter(function (r) {
      if (
        String(r.status) !== 'published' &&
        String(r.userId) !== String(user.userId)
      ) {
        return false;
      }

      const title = String(r.title || '').toLowerCase();
      const body = bodyFromContentJson_(r.contentJson).toLowerCase();
      const name = String(r.name || r.userId || '').toLowerCase();

      return (
        title.indexOf(query) !== -1 ||
        body.indexOf(query) !== -1 ||
        name.indexOf(query) !== -1
      );
    })
    .sort(function (a, b) {
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    })
    .slice(0, 100)
    .map(function (r) {
      return {
        diaryId:String(r.diaryId),
        userId:String(r.userId),
        name:String(r.name || r.userId),
        title:String(r.title || ''),
        status:String(r.status || 'published'),
        createdAt:iso_(r.createdAt),
        updatedAt:iso_(r.updatedAt),
        own:String(r.userId) === String(user.userId)
      };
    });
}

function deleteDiary(token, diaryId) {
  return withLock_(function () {
    const user = auth_(token);

    const diary = rows_(APP.SHEETS.DIARIES).find(function (r) {
      return String(r.diaryId) === String(diaryId);
    });

    if (!diary || String(diary.userId) !== String(user.userId)) {
      throw new Error('削除権限がありません。');
    }

    deleteRowsWhere_(APP.SHEETS.COMMENTS, function (r) {
      return String(r.diaryId) === String(diaryId);
    });

    deleteRowsWhere_(APP.SHEETS.NOTIFICATIONS, function (r) {
      return String(r.diaryId) === String(diaryId);
    });

    sheet_(APP.SHEETS.DIARIES).deleteRow(diary._row);

    return true;
  });
}

/* =========================================================
   コメント
   ========================================================= */
function addComment(token, diaryId, body) {
  return withLock_(function () {
    const user = auth_(token);

    const diary = rows_(APP.SHEETS.DIARIES).find(function (r) {
      return String(r.diaryId) === String(diaryId);
    });

    if (
      !diary ||
      (
        String(diary.status) !== 'published' &&
        String(diary.userId) !== String(user.userId)
      )
    ) {
      throw new Error('コメント対象の日記がありません。');
    }

    body = String(body || '').trim();

    if (!body || body.length > 1000) {
      throw new Error('コメントは1〜1000文字で入力してください。');
    }

    const commentId = createId_('comment');
    const now = new Date();

    sheet_(APP.SHEETS.COMMENTS).appendRow([
      commentId,
      String(diaryId),
      String(user.userId),
      String(user.name || user.userId),
      body,
      now,
      false
    ]);

    // 自分の日記への自分のコメントでは通知を作らない
    if (String(diary.userId) !== String(user.userId)) {
      sheet_(APP.SHEETS.NOTIFICATIONS).appendRow([
        createId_('notification'),
        String(diary.userId),
        'comment',
        String(diaryId),
        commentId,
        String(user.userId),
        String(user.name || user.userId) + 'さんが「' + String(diary.title || '日記') + '」にコメントしました',
        now,
        false
      ]);
    }

    return getDiaryForUser_(user, diaryId);
  });
}

function deleteComment(token, commentId) {
  return withLock_(function () {
    const user = auth_(token);

    const comment = rows_(APP.SHEETS.COMMENTS).find(function (r) {
      return String(r.commentId) === String(commentId);
    });

    if (!comment) throw new Error('コメントが見つかりません。');

    const diary = rows_(APP.SHEETS.DIARIES).find(function (r) {
      return String(r.diaryId) === String(comment.diaryId);
    });

    const canDelete =
      String(comment.userId) === String(user.userId) ||
      (diary && String(diary.userId) === String(user.userId));

    if (!canDelete) {
      throw new Error('コメントを削除する権限がありません。');
    }

    sheet_(APP.SHEETS.COMMENTS).getRange(comment._row, 7).setValue(true);

    return getDiaryForUser_(user, comment.diaryId);
  });
}

/* =========================================================
   通知
   ========================================================= */
function notificationsForUser_(user) {
  return rows_(APP.SHEETS.NOTIFICATIONS)
    .filter(function (n) {
      return String(n.userId) === String(user.userId);
    })
    .sort(function (a, b) {
      return new Date(b.createdAt) - new Date(a.createdAt);
    })
    .slice(0, 50)
    .map(function (n) {
      return {
        notificationId:String(n.notificationId),
        type:String(n.type || ''),
        diaryId:String(n.diaryId || ''),
        commentId:String(n.commentId || ''),
        fromUserId:String(n.fromUserId || ''),
        message:String(n.message || ''),
        createdAt:iso_(n.createdAt),
        read:toBool_(n.read, false)
      };
    });
}

function getNotifications(token) {
  const user = auth_(token);
  return notificationsForUser_(user);
}

function markNotificationRead(token, notificationId) {
  return withLock_(function () {
    const user = auth_(token);

    const n = rows_(APP.SHEETS.NOTIFICATIONS).find(function (r) {
      return (
        String(r.notificationId) === String(notificationId) &&
        String(r.userId) === String(user.userId)
      );
    });

    if (n) {
      sheet_(APP.SHEETS.NOTIFICATIONS).getRange(n._row, 9).setValue(true);
    }

    return notificationsForUser_(user);
  });
}

function markAllNotificationsRead(token) {
  return withLock_(function () {
    const user = auth_(token);
    const sh = sheet_(APP.SHEETS.NOTIFICATIONS);

    rows_(APP.SHEETS.NOTIFICATIONS)
      .filter(function (n) {
        return (
          String(n.userId) === String(user.userId) &&
          !toBool_(n.read, false)
        );
      })
      .forEach(function (n) {
        sh.getRange(n._row, 9).setValue(true);
      });

    return notificationsForUser_(user);
  });
}
