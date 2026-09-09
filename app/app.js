const SUPABASE_URL =
  'https://hwadprvpvxtbiiuvpsso.supabase.co';

const SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_ydrTup3LoNdul7KeXWVwwg_raIcSjFy';


const supabaseClient =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );


// ==================================================
// DOM
// ==================================================

const loginScreen =
  document.getElementById('login-screen');

const homeScreen =
  document.getElementById('home-screen');

const loginForm =
  document.getElementById('login-form');

const loginMessage =
  document.getElementById('login-message');

const welcomeMessage =
  document.getElementById('welcome-message');

const logoutButton =
  document.getElementById('logout-button');

const githubLoginButton =
  document.getElementById('github-login-button');

const homeUserCard =
  document.getElementById('home-user-card');

const diaryPageTitle =
  document.getElementById('diary-page-title');

const diaryList =
  document.getElementById('diary-list');

const diaryMessage =
  document.getElementById('diary-message');

const allDiariesButton =
  document.getElementById('all-diaries-button');

const myDiariesButton =
  document.getElementById('my-diaries-button');

const newDiaryButton =
  document.getElementById('new-diary-button');

const diaryDetailHeader =
  document.getElementById('diary-detail-header');

const diaryDetailHeaderTitle =
  document.getElementById(
    'diary-detail-header-title'
  );

const diaryDetailHeaderMeta =
  document.getElementById(
    'diary-detail-header-meta'
  );

const diaryDetail =
  document.getElementById('diary-detail');

const diaryDetailContent =
  document.getElementById(
    'diary-detail-content'
  );

const diaryDetailBack =
  document.getElementById(
    'diary-detail-back'
  );

const diaryEditor =
  document.getElementById('diary-editor');

const diaryEditorBack =
  document.getElementById(
    'diary-editor-back'
  );

const diaryTitleInput =
  document.getElementById(
    'diary-title-input'
  );

const diaryContentInput =
  document.getElementById(
    'diary-content-input'
  );

const diaryEditorMessage =
  document.getElementById(
    'diary-editor-message'
  );

const diarySaveButton =
  document.getElementById(
    'diary-save-button'
  );


// コメント関連
const commentsSection =
  document.getElementById(
    'comments-section'
  );

const commentList =
  document.getElementById(
    'comment-list'
  );

const commentInput =
  document.getElementById(
    'comment-input'
  );

const commentMessage =
  document.getElementById(
    'comment-message'
  );

const commentSubmitButton =
  document.getElementById(
    'comment-submit-button'
  );


// ==================================================
// 現在の状態
// ==================================================

let currentDiaryId = null;

let currentUser = null;

let replyingToCommentId = null;


// ==================================================
// GitHubログイン
// ==================================================

githubLoginButton.addEventListener(
  'click',
  async () => {

    loginMessage.textContent =
      'GitHubへ移動しています…';

    const {
      error
    } =
      await supabaseClient.auth
        .signInWithOAuth({
          provider: 'github',
          options: {
            redirectTo:
              window.location.origin
          }
        });

    if (error) {

      console.error(
        'GitHubログインエラー:',
        error
      );

      loginMessage.textContent =
        'GitHubログインに失敗しました。';
    }

  }
);


// ==================================================
// ログイン状態確認
// ==================================================

async function checkLogin() {

  const {
    data: {
      session
    },
    error
  } =
    await supabaseClient.auth
      .getSession();

  if (error) {

    console.error(
      'セッション取得エラー:',
      error
    );

    showLogin();

    return;
  }


  if (session) {

    await showHome(
      session.user
    );

  } else {

    showLogin();

  }

}


// ==================================================
// ホーム表示
// ==================================================

async function showHome(
  authUser
) {

  const {
    data: user,
    error
  } =
    await supabaseClient
      .from('users')
      .select(`
        user_id,
        name,
        active,
        email,
        auth_user_id
      `)
      .eq(
        'auth_user_id',
        authUser.id
      )
      .maybeSingle();


  if (error) {

    console.error(
      'ユーザー情報取得エラー:',
      error
    );

    loginMessage.textContent =
      'ユーザー情報の取得に失敗しました。';

    return;
  }


  if (!user) {

    loginMessage.textContent =
      'このGitHubアカウントは登録されていません。';

    return;
  }


  if (!user.active) {

    loginMessage.textContent =
      'このアカウントは現在無効になっています。';

    return;
  }


  currentUser = user;


  loginScreen.classList.add(
    'hidden'
  );

  homeScreen.classList.remove(
    'hidden'
  );


  welcomeMessage.textContent =
    `${user.name}さん、ようこそ！`;


  showDiaryHome();

await loadDiaries('all');

requestNotificationPermission();

}


// ==================================================
// ログイン画面
// ==================================================

function showLogin() {

  loginScreen.classList.remove(
    'hidden'
  );

  homeScreen.classList.add(
    'hidden'
  );

}


// ==================================================
// ログアウト
// ==================================================

logoutButton.addEventListener(
  'click',
  async () => {

    const {
      error
    } =
      await supabaseClient.auth
        .signOut();

    if (error) {

      console.error(
        'ログアウトエラー:',
        error
      );

      return;
    }


    currentUser = null;

    currentDiaryId = null;

    showLogin();

  }
);


// ==================================================
// 日記一覧画面
// ==================================================

function showDiaryHome() {

  homeUserCard.classList.remove(
    'hidden'
  );

  diaryPageTitle.classList.remove(
    'hidden'
  );

  diaryList.classList.remove(
    'hidden'
  );

  diaryDetailHeader.classList.add(
    'hidden'
  );

  diaryDetail.classList.add(
    'hidden'
  );

  diaryEditor.classList.add(
    'hidden'
  );

  allDiariesButton.classList.remove(
    'hidden'
  );

  myDiariesButton.classList.remove(
    'hidden'
  );

  newDiaryButton.classList.remove(
    'hidden'
  );

  if (commentsSection) {

    commentsSection.classList.add(
      'hidden'
    );

  }

}


// ==================================================
// 日記一覧
// ==================================================

async function loadDiaries(
  filter = 'all'
) {

  diaryMessage.textContent =
    '日記を読み込んでいます…';

  diaryList.innerHTML = '';


  let query =
    supabaseClient
      .from('diaries')
      .select(`
        diary_id,
        user_id,
        name,
        title,
        status,
        created_at,
        updated_at,
        published_at
      `)
      .order(
        'updated_at',
        {
          ascending: false
        }
      )
      .limit(100);


  if (filter === 'mine') {

    const {
      data: {
        user: authUser
      }
    } =
      await supabaseClient.auth
        .getUser();


    if (!authUser) {

      diaryMessage.textContent =
        'ログイン情報を取得できませんでした。';

      return;
    }


    const {
      data: appUser,
      error
    } =
      await supabaseClient
        .from('users')
        .select('user_id')
        .eq(
          'auth_user_id',
          authUser.id
        )
        .maybeSingle();


    if (
      error ||
      !appUser
    ) {

      console.error(error);

      diaryMessage.textContent =
        'ユーザー情報を取得できませんでした。';

      return;
    }


    query =
      query.eq(
        'user_id',
        appUser.user_id
      );

  }


  const {
    data,
    error
  } =
    await query;


  if (error) {

    console.error(
      '日記取得エラー:',
      error
    );

    diaryMessage.textContent =
      '日記の取得に失敗しました。';

    return;
  }


  diaryMessage.textContent = '';


  if (
    !data ||
    data.length === 0
  ) {

    diaryList.innerHTML =
      '<p class="message">日記がありません。</p>';

    return;
  }


  data.forEach(
    diary => {

      const item =
        document.createElement(
          'div'
        );


      item.className =
        'diary-item';


      item.dataset.diaryId =
        diary.diary_id;


      item.innerHTML = `
        <p class="diary-title">
          ${escapeHtml(
            diary.title || '無題'
          )}
        </p>

        <p class="diary-meta">
          名前：
          ${escapeHtml(
            diary.name || diary.user_id
          )}
        </p>

        <p class="diary-meta">
          更新日時：
          ${formatDate(
            diary.updated_at
          )}
        </p>

        ${
          diary.status === 'draft'
            ? '<span class="diary-status">下書き</span>'
            : ''
        }
      `;


      item.addEventListener(
        'click',
        () => {

          openDiary(
            diary.diary_id
          );

        }
      );


      diaryList.appendChild(
        item
      );

    }
  );

}


// ==================================================
// みんなの日記
// ==================================================

allDiariesButton.addEventListener(
  'click',
  async () => {

    showDiaryHome();

    await loadDiaries(
      'all'
    );

  }
);


// ==================================================
// 自分の日記
// ==================================================

myDiariesButton.addEventListener(
  'click',
  async () => {

    showDiaryHome();

    await loadDiaries(
      'mine'
    );

  }
);


// ==================================================
// 日記詳細
// ==================================================

async function openDiary(
  diaryId
) {

  currentDiaryId =
    diaryId;


  // 一覧側を隠す
  homeUserCard.classList.add(
    'hidden'
  );

  diaryPageTitle.classList.add(
    'hidden'
  );

  diaryList.classList.add(
    'hidden'
  );

  allDiariesButton.classList.add(
    'hidden'
  );

  myDiariesButton.classList.add(
    'hidden'
  );

  newDiaryButton.classList.add(
    'hidden'
  );


  // 詳細ヘッダー表示
  diaryDetailHeader.classList.remove(
    'hidden'
  );


  // 本文表示
  diaryDetail.classList.remove(
    'hidden'
  );


  diaryEditor.classList.add(
    'hidden'
  );


  // コメント表示
  if (commentsSection) {

    commentsSection.classList.remove(
      'hidden'
    );

  }


  diaryDetailHeaderTitle.textContent =
    '読み込んでいます…';

  diaryDetailHeaderMeta.textContent =
    '';

  diaryDetailContent.textContent =
    '';


  // 日記取得
  const {
    data,
    error
  } =
    await supabaseClient
      .from('diaries')
      .select(`
        diary_id,
        user_id,
        name,
        title,
        status,
        content_json,
        created_at,
        updated_at,
        published_at
      `)
      .eq(
        'diary_id',
        diaryId
      )
      .maybeSingle();


  if (error) {

    console.error(
      '日記詳細取得エラー:',
      error
    );

    diaryDetailHeaderTitle.textContent =
      '日記を取得できませんでした。';

    return;
  }


  if (!data) {

    diaryDetailHeaderTitle.textContent =
      '日記が見つかりません。';

    return;
  }


  // タイトル
  diaryDetailHeaderTitle.textContent =
    data.title || '無題';


  // 名前・日時
  diaryDetailHeaderMeta.innerHTML = `
    <div>
      <strong>名前</strong>
      <br>
      ${escapeHtml(
        data.name || data.user_id
      )}
    </div>

    <div style="margin-top: 8px;">
      <strong>日時</strong>
      <br>
      ${formatDate(
        data.updated_at
      )}
    </div>
  `;


  // 本文
  diaryDetailContent.textContent =
    contentJsonToText(
      data.content_json
    );


  // コメント取得
  await loadComments(
    diaryId
  );

}


// ==================================================
// 日記詳細 → 一覧
// ==================================================

diaryDetailBack.addEventListener(
  'click',
  async () => {

    currentDiaryId =
      null;

    showDiaryHome();

    await loadDiaries(
      'all'
    );

  }
);


// ==================================================
// 新しく書く
// ==================================================

newDiaryButton.addEventListener(
  'click',
  () => {

    homeUserCard.classList.add(
      'hidden'
    );

    diaryPageTitle.classList.add(
      'hidden'
    );

    diaryControlsHide();


    diaryList.classList.add(
      'hidden'
    );

    diaryDetailHeader.classList.add(
      'hidden'
    );

    diaryDetail.classList.add(
      'hidden'
    );


    diaryEditor.classList.remove(
      'hidden'
    );


    if (commentsSection) {

      commentsSection.classList.add(
        'hidden'
      );

    }


    diaryTitleInput.value =
      '';

    diaryContentInput.value =
      '';

    diaryEditorMessage.textContent =
      '';

  }
);


// ==================================================
// 日記操作ボタンを隠す
// ==================================================

function diaryControlsHide() {

  allDiariesButton.classList.add(
    'hidden'
  );

  myDiariesButton.classList.add(
    'hidden'
  );

  newDiaryButton.classList.add(
    'hidden'
  );

}


// ==================================================
// 新規作成 → 一覧
// ==================================================

diaryEditorBack.addEventListener(
  'click',
  async () => {

    showDiaryHome();

    await loadDiaries(
      'all'
    );

  }
);


// ==================================================
// 日記保存
// ==================================================

diarySaveButton.addEventListener(
  'click',
  async () => {

    const title =
      diaryTitleInput.value.trim();

    const content =
      diaryContentInput.value.trim();


    if (!title) {

      diaryEditorMessage.textContent =
        'タイトルを入力してください。';

      return;
    }


    if (!content) {

      diaryEditorMessage.textContent =
        '本文を入力してください。';

      return;
    }


    diarySaveButton.disabled =
      true;

    diaryEditorMessage.textContent =
      '保存しています…';


    try {

      const {
        data: {
          user: authUser
        }
      } =
        await supabaseClient.auth
          .getUser();


      if (!authUser) {

        diaryEditorMessage.textContent =
          'ログイン情報を取得できませんでした。';

        return;
      }


      const {
        data: appUser,
        error: userError
      } =
        await supabaseClient
          .from('users')
          .select(
            'user_id, name'
          )
          .eq(
            'auth_user_id',
            authUser.id
          )
          .maybeSingle();


      if (
        userError ||
        !appUser
      ) {

        console.error(
          userError
        );

        diaryEditorMessage.textContent =
          'ユーザー情報を取得できませんでした。';

        return;
      }


      const diaryId =
        generateId();


      const contentJson = [
        {
          type: 'text',
          text: content
        }
      ];


      const {
        error
      } =
        await supabaseClient
          .from('diaries')
          .insert({
            diary_id:
              diaryId,

            user_id:
              appUser.user_id,

            name:
              appUser.name,

            title:
              title,

            status:
              'published',

            content_json:
              contentJson,

            published_at:
              new Date().toISOString()
          });


      if (error) {

        console.error(
          '日記保存エラー:',
          error
        );

        diaryEditorMessage.textContent =
          '日記の保存に失敗しました。';

        return;
      }


      diaryEditorMessage.textContent =
        '保存しました。';


      showDiaryHome();

      await loadDiaries(
        'all'
      );

    } finally {

      diarySaveButton.disabled =
        false;

    }

  }
);


// ==================================================
// コメント一覧
// ==================================================

async function loadComments(
  diaryId
) {

  if (!commentList) {
    return;
  }


  commentList.innerHTML =
    '<p>コメントを読み込んでいます…</p>';


  const {
    data,
    error
  } =
    await supabaseClient
      .from('comments')
      .select(`
        comment_id,
        diary_id,
        user_id,
        name,
        body,
        created_at,
        deleted,
        parent_comment_id
      `)
      .eq(
        'diary_id',
        diaryId
      )
      .order(
        'created_at',
        {
          ascending: true
        }
      );


  if (error) {

    console.error(
      'コメント取得エラー:',
      error
    );

    commentList.innerHTML =
      '<p>コメントを取得できませんでした。</p>';

    return;
  }


  commentList.innerHTML =
    '';


  if (
    !data ||
    data.length === 0
  ) {

    commentList.innerHTML =
      '<p>まだコメントはありません。</p>';

    return;
  }


  const comments =
    data.filter(
      comment =>
        !comment.deleted
    );


  const roots =
    comments.filter(
      comment =>
        !comment.parent_comment_id
    );


  roots.forEach(
    root => {

      renderComment(
        root,
        comments,
        commentList,
        0
      );

    }
  );

}


// ==================================================
// コメント表示
// ==================================================

function renderComment(
  comment,
  allComments,
  parentElement,
  level
) {

  const wrapper =
    document.createElement(
      'div'
    );


  wrapper.className =
    'comment-item';


  wrapper.style.marginLeft =
    `${Math.min(level, 3) * 20}px`;


  const body =
    document.createElement(
      'div'
    );


  body.innerHTML = `
    <div class="comment-author">
      ${escapeHtml(
        comment.name ||
        comment.user_id
      )}
    </div>

    <div class="comment-body">
      ${escapeHtml(
        comment.body
      )}
    </div>

    <div class="comment-date">
      ${formatDate(
        comment.created_at
      )}
    </div>
  `;


  wrapper.appendChild(
    body
  );


  // 返信ボタン
  const replyButton =
    document.createElement(
      'button'
    );


  replyButton.type =
    'button';

  replyButton.textContent =
    '返信';

  replyButton.className =
    'secondary-button comment-reply-button';


  replyButton.addEventListener(
    'click',
    () => {

      replyingToCommentId =
        comment.comment_id;

      commentInput.focus();

      commentMessage.textContent =
        `${comment.name || comment.user_id}さんへの返信`;

    }
  );


  wrapper.appendChild(
    replyButton
  );


  // 自分のコメントなら削除
  if (
    currentUser &&
    comment.user_id ===
      currentUser.user_id
  ) {

    const deleteButton =
      document.createElement(
        'button'
      );


    deleteButton.type =
      'button';

    deleteButton.textContent =
      '削除';

    deleteButton.className =
      'secondary-button comment-delete-button';


    deleteButton.addEventListener(
      'click',
      async () => {

        await deleteComment(
          comment.comment_id
        );

      }
    );


    wrapper.appendChild(
      deleteButton
    );

  }


  parentElement.appendChild(
    wrapper
  );


  // 子コメント＝返信
  const replies =
    allComments.filter(
      child =>
        child.parent_comment_id ===
        comment.comment_id
    );


  replies.forEach(
    reply => {

      renderComment(
        reply,
        allComments,
        parentElement,
        level + 1
      );

    }
  );

}


// ==================================================
// コメント投稿
// ==================================================

commentSubmitButton.addEventListener(
  'click',
  async () => {

    await submitComment();

  }
);


// ==================================================
// コメント投稿処理
// ==================================================

async function submitComment() {

  if (!currentDiaryId) {

    return;
  }


  const body =
    commentInput.value.trim();


  if (!body) {

    commentMessage.textContent =
      'コメントを入力してください。';

    return;
  }


  if (!currentUser) {

    commentMessage.textContent =
      'ログインしてください。';

    return;
  }


  commentSubmitButton.disabled =
    true;

  commentMessage.textContent =
    '投稿しています…';


  try {

    const commentId =
      generateId();


    const parentId =
      replyingToCommentId ||
      null;


    // コメント投稿
    const {
      data: insertedComment,
      error
    } =
      await supabaseClient
        .from('comments')
        .insert({
          comment_id:
            commentId,

          diary_id:
            currentDiaryId,

          user_id:
            currentUser.user_id,

          name:
            currentUser.name,

          body:
            body,

          parent_comment_id:
            parentId,

          deleted:
            false
        })
        .select()
        .single();


    if (error) {

      console.error(
        'コメント投稿エラー:',
        error
      );

      commentMessage.textContent =
        'コメントの投稿に失敗しました。';

      return;
    }


    // 通知
    await createCommentNotification(
      insertedComment
    );


    commentInput.value =
      '';

    replyingToCommentId =
      null;

    commentMessage.textContent =
      '投稿しました。';


    await loadComments(
      currentDiaryId
    );

  } finally {

    commentSubmitButton.disabled =
      false;

  }

}


// ==================================================
// コメント通知
// ==================================================

async function createCommentNotification(
  comment
) {

  try {

    let targetUserId =
      null;

    let message =
      '';


    // 返信の場合
    if (
      comment.parent_comment_id
    ) {

      const {
        data: parentComment
      } =
        await supabaseClient
          .from('comments')
          .select(
            'user_id'
          )
          .eq(
            'comment_id',
            comment.parent_comment_id
          )
          .maybeSingle();


      if (
        parentComment &&
        parentComment.user_id !==
          currentUser.user_id
      ) {

        targetUserId =
          parentComment.user_id;

        message =
          `${currentUser.name}さんがあなたのコメントに返信しました。`;

      }

    } else {

      // 通常コメントの場合は日記投稿者へ
      const {
        data: diary
      } =
        await supabaseClient
          .from('diaries')
          .select(
            'user_id, title'
          )
          .eq(
            'diary_id',
            comment.diary_id
          )
          .maybeSingle();


      if (
        diary &&
        diary.user_id !==
          currentUser.user_id
      ) {

        targetUserId =
          diary.user_id;

        message =
          `${currentUser.name}さんが「${diary.title}」にコメントしました。`;

      }

    }


    if (!targetUserId) {

      return;

    }


    await supabaseClient
      .from('notifications')
      .insert({
        notification_id:
          generateId(),

        user_id:
          targetUserId,

        type:
          comment.parent_comment_id
            ? 'comment_reply'
            : 'comment',

        diary_id:
          comment.diary_id,

        comment_id:
          comment.comment_id,

        from_user_id:
          currentUser.user_id,

        message:
          message,

        created_at:
          new Date().toISOString(),

        read:
          false
      });

  } catch (error) {

    console.error(
      '通知作成エラー:',
      error
    );

  }

}


// ==================================================
// コメント削除
// ==================================================

async function deleteComment(
  commentId
) {

  if (
    !confirm(
      'このコメントを削除しますか？'
    )
  ) {

    return;

  }


  const {
    error
  } =
    await supabaseClient
      .from('comments')
      .update({
        deleted:
          true
      })
      .eq(
        'comment_id',
        commentId
      );


  if (error) {

    console.error(
      'コメント削除エラー:',
      error
    );

    alert(
      'コメントを削除できませんでした。'
    );

    return;
  }


  await loadComments(
    currentDiaryId
  );

}


// ==================================================
// content_json → 本文
// ==================================================

function contentJsonToText(
  content
) {

  if (!content) {

    return '';

  }


  try {

    const blocks =
      typeof content ===
        'string'
        ? JSON.parse(content)
        : content;


    if (
      !Array.isArray(
        blocks
      )
    ) {

      return String(
        content
      );

    }


    return blocks
      .filter(
        block =>
          block &&
          block.type ===
            'text'
      )
      .map(
        block =>
          block.text ||
          ''
      )
      .join(
        '\n\n'
      );

  } catch (error) {

    console.error(
      'content_json解析エラー:',
      error
    );

    return String(
      content
    );

  }

}


// ==================================================
// ID生成
// ==================================================

function generateId() {

  if (
    window.crypto &&
    typeof window.crypto.randomUUID ===
      'function'
  ) {

    return window.crypto.randomUUID();

  }


  return (
    'id_' +
    Date.now() +
    '_' +
    Math.random()
      .toString(36)
      .substring(
        2,
        10
      )
  );

}


// ==================================================
// 日付
// ==================================================

function formatDate(
  value
) {

  if (!value) {

    return '';

  }


  const date =
    new Date(
      value
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return '';

  }


  return date.toLocaleString(
    'ja-JP',
    {
      year:
        'numeric',

      month:
        '2-digit',

      day:
        '2-digit',

      hour:
        '2-digit',

      minute:
        '2-digit'
    }
  );

}


// ==================================================
// HTMLエスケープ
// ==================================================

function escapeHtml(
  value
) {

  return String(
    value
  )
    .replace(
      /&/g,
      '&amp;'
    )
    .replace(
      /</g,
      '&lt;'
    )
    .replace(
      />/g,
      '&gt;'
    )
    .replace(
      /"/g,
      '&quot;'
    )
    .replace(
      /'/g,
      '&#039;'
    );

}


// ==================================================
// Auth監視
// ==================================================

supabaseClient.auth
  .onAuthStateChange(
    async (
      event,
      session
    ) => {

      console.log(
        'Auth event:',
        event
      );


      if (session) {

        await showHome(
          session.user
        );

      } else {

        showLogin();

      }

    }
  );


// ==================================================
// 起動
// ==================================================

checkLogin();

// ==================================================
// Service Worker登録
// ==================================================

if ('serviceWorker' in navigator) {

  window.addEventListener(
    'load',
    async () => {

      try {

        const registration =
          await navigator.serviceWorker.register(
            './sw.js'
          );

        console.log(
          'Service Worker登録成功:',
          registration.scope
        );

      } catch (error) {

        console.error(
          'Service Worker登録失敗:',
          error
        );

      }

    }
  );

}

// ==================================================
// プッシュ通知の許可
// ==================================================

async function requestNotificationPermission() {

  if (!('Notification' in window)) {
    console.log('このブラウザは通知に対応していません。');
    return;
  }

  if (!('serviceWorker' in navigator)) {
    console.log('Service Workerに対応していません。');
    return;
  }

  if (Notification.permission === 'granted') {
    console.log('通知はすでに許可されています。');
    return;
  }

  if (Notification.permission === 'denied') {
    console.log('通知が拒否されています。');
    return;
  }

  const permission =
    await Notification.requestPermission();

  console.log(
    '通知許可状態:',
    permission
  );
}