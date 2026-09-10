const SUPABASE_URL =
  'https://hwadprvpvxtbiiuvpsso.supabase.co';

const SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_ydrTup3LoNdul7KeXWVwwg_raIcSjFy';


  const VAPID_PUBLIC_KEY =
  'BH7tIw5nGKRPl-h391xF12CPQc7woidvAEWoLkx4UyjcRCVZopcuJ4hXgJ0w7TNha2AFPRlEeHRTl_yBvAOImsU';


const supabaseClient =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
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

const diaryEditButton = document.getElementById('diary-edit-button');
const diaryEditorTitle = document.getElementById('diary-editor-title');


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

const commentOpenButton =
  document.getElementById(
    'comment-open-button'
  );

const commentCancelButton =
  document.getElementById(
    'comment-cancel-button'
  );


// ==================================================
// 現在の状態
// ==================================================

let currentDiaryId = null;

let currentUser = null;

let replyingToCommentId = null;
let currentEditingDiaryId = null;


// ==================================================
// ID・パスワードログイン
// ==================================================

loginForm.addEventListener(
  'submit',
  async (event) => {

    event.preventDefault();

    const userId =
      document.getElementById('user-id')
        .value
        .trim();

    const password =
      document.getElementById('password')
        .value;

    if (!userId || !password) {
      loginMessage.textContent =
        'IDとパスワードを入力してください。';
      return;
    }

    loginMessage.textContent =
      'ログインしています…';

    const submitButton =
      loginForm.querySelector('button[type="submit"]');

    if (submitButton) {
      submitButton.disabled = true;
    }

    try {

      const response =
        await fetch(
          `${SUPABASE_URL}/functions/v1/legacy-login`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              userId,
              password
            })
          }
        );

      const result =
        await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
          'IDまたはパスワードが違います。'
        );
      }

      if (!result.session) {
        throw new Error(
          'ログインセッションを取得できませんでした。'
        );
      }

      const { error: sessionError } =
        await supabaseClient.auth.setSession({
          access_token: result.session.access_token,
          refresh_token: result.session.refresh_token
        });

      if (sessionError) {
        throw sessionError;
      }

      loginMessage.textContent = '';

      document.getElementById('password').value = '';

    } catch (error) {

      console.error(
        'ID・パスワードログインエラー:',
        error
      );

      loginMessage.textContent =
        error.message ||
        'ログインに失敗しました。';

    } finally {

      if (submitButton) {
        submitButton.disabled = false;
      }

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

    // 以前のGitHub OAuthセッションがブラウザに残っている場合は破棄する
    const provider =
      session.user?.app_metadata?.provider;

    if (provider === 'github') {
      await supabaseClient.auth.signOut();
      showLogin();
      return;
    }

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
      'このアカウントは登録されていません。';

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

  if (diaryEditButton) {
    diaryEditButton.classList.add('hidden');
  }

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

  closeCommentForm();


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
    <div class="detail-meta-item">
      <span class="detail-meta-label">名前</span>
      <span class="detail-meta-value">${escapeHtml(data.name || data.user_id)}</span>
    </div>
    <div class="detail-meta-item">
      <span class="detail-meta-label">日時</span>
      <span class="detail-meta-value">${formatDate(data.updated_at)}</span>
    </div>
  `;

  // 本文
  diaryDetailContent.textContent =
    contentJsonToText(
      data.content_json
    );

  if (diaryEditButton) {
    diaryEditButton.classList.toggle(
      'hidden',
      !(currentUser && data.user_id === currentUser.user_id)
    );
  }


  // コメント取得
  await loadComments(
    diaryId
  );

}


// ==================================================
// 日記編集開始
// ==================================================

if (diaryEditButton) {
  diaryEditButton.addEventListener('click', async () => {
    if (!currentDiaryId || !currentUser) return;

    const { data, error } = await supabaseClient
      .from('diaries')
      .select('diary_id, user_id, title, content_json')
      .eq('diary_id', currentDiaryId)
      .eq('user_id', currentUser.user_id)
      .maybeSingle();

    if (error || !data) {
      console.error('日記編集取得エラー:', error);
      alert('日記を編集できませんでした。');
      return;
    }

    currentEditingDiaryId = data.diary_id;
    homeUserCard.classList.add('hidden');
    diaryPageTitle.classList.add('hidden');
    diaryList.classList.add('hidden');
    diaryDetailHeader.classList.add('hidden');
    diaryDetail.classList.add('hidden');
    diaryControlsHide();
    if (commentsSection) commentsSection.classList.add('hidden');
    diaryEditor.classList.remove('hidden');
    diaryEditorTitle.textContent = '日記を編集';
    diaryTitleInput.value = data.title || '';
    diaryContentInput.value = contentJsonToText(data.content_json);
    diaryEditorMessage.textContent = '';
    diarySaveButton.textContent = '変更を保存';
  });
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


    currentEditingDiaryId = null;
    diaryEditorTitle.textContent = '新しい日記';
    diarySaveButton.textContent = '日記を保存';

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


      const contentJson = [
        {
          type: 'text',
          text: content
        }
      ];

      let saveError = null;

      if (currentEditingDiaryId) {
        const { error } = await supabaseClient
          .from('diaries')
          .update({
            title: title,
            content_json: contentJson,
            updated_at: new Date().toISOString()
          })
          .eq('diary_id', currentEditingDiaryId)
          .eq('user_id', appUser.user_id);
        saveError = error;
      } else {
        const diaryId = generateId();
        const { error } = await supabaseClient
          .from('diaries')
          .insert({
            diary_id: diaryId,
            user_id: appUser.user_id,
            name: appUser.name,
            title: title,
            status: 'published',
            content_json: contentJson,
            published_at: new Date().toISOString()
          });
        saveError = error;
      }


      if (saveError) {

        console.error(
          '日記保存エラー:',
          saveError
        );

        diaryEditorMessage.textContent =
          '日記の保存に失敗しました。';

        return;
      }


      diaryEditorMessage.textContent =
        '保存しました。';

      const savedDiaryId = currentEditingDiaryId;
      currentEditingDiaryId = null;
      diaryEditorTitle.textContent = '新しい日記';
      diarySaveButton.textContent = '日記を保存';

      if (savedDiaryId) {
        await openDiary(savedDiaryId);
      } else {
        showDiaryHome();
        await loadDiaries('all');
      }

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
  const wrapper = document.createElement('div');
  wrapper.className = 'comment-thread';
  if (level > 0) wrapper.classList.add('comment-reply-thread');

  const card = document.createElement('article');
  card.className = 'comment-item';

  const body = document.createElement('div');
  body.innerHTML = `
    <div class="comment-topline">
      <span class="comment-author">${escapeHtml(comment.name || comment.user_id)}</span>
      <span class="comment-date">${formatDate(comment.created_at)}</span>
    </div>
    <div class="comment-body">${escapeHtml(comment.body)}</div>
  `;
  card.appendChild(body);

  const actions = document.createElement('div');
  actions.className = 'comment-actions';

  const replyButton = document.createElement('button');
  replyButton.type = 'button';
  replyButton.textContent = '返信';
  replyButton.className = 'comment-action-button';
  replyButton.addEventListener('click', () => {
    replyingToCommentId = comment.comment_id;
    openCommentForm();
    commentMessage.textContent = `${comment.name || comment.user_id}さんへの返信`;
    commentInput.focus();
    commentInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  actions.appendChild(replyButton);

  if (currentUser && comment.user_id === currentUser.user_id) {
    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.textContent = '削除';
    deleteButton.className = 'comment-action-button comment-delete-button';
    deleteButton.addEventListener('click', async () => {
      await deleteComment(comment.comment_id);
    });
    actions.appendChild(deleteButton);
  }

  card.appendChild(actions);
  wrapper.appendChild(card);
  parentElement.appendChild(wrapper);

  const replies = allComments.filter(child => child.parent_comment_id === comment.comment_id);
  if (replies.length > 0) {
    const replyToggle = document.createElement('button');
    replyToggle.type = 'button';
    replyToggle.className = 'reply-toggle';
    replyToggle.textContent = `▶ 返信 ${replies.length}件`;

    const replyContainer = document.createElement('div');
    replyContainer.className = 'comment-replies hidden';

    replyToggle.addEventListener('click', () => {
      const isHidden = replyContainer.classList.toggle('hidden');
      replyToggle.textContent = `${isHidden ? '▶' : '▼'} 返信 ${replies.length}件`;
    });

    wrapper.appendChild(replyToggle);
    wrapper.appendChild(replyContainer);
    replies.forEach(reply => renderComment(reply, allComments, replyContainer, level + 1));
  }
}


// ==================================================
// コメント投稿
// ==================================================

commentOpenButton.addEventListener(
  'click',
  () => {
    openCommentForm();
  }
);

commentCancelButton.addEventListener(
  'click',
  () => {
    closeCommentForm();
  }
);

commentSubmitButton.addEventListener(
  'click',
  async () => {

    await submitComment();

  }
);


// ==================================================
// コメント入力欄の開閉
// ==================================================

function openCommentForm() {
  const form = document.querySelector('.comment-form');

  if (!form) {
    return;
  }

  form.classList.remove('hidden');
  commentOpenButton.classList.add('hidden');
  commentMessage.textContent = '';
  commentInput.focus();
}

function closeCommentForm() {
  const form = document.querySelector('.comment-form');

  if (!form) {
    return;
  }

  form.classList.add('hidden');
  commentOpenButton.classList.remove('hidden');
  commentInput.value = '';
  commentMessage.textContent = '';
  replyingToCommentId = null;
}

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

    closeCommentForm();

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
// プッシュ通知登録
// ==================================================

async function requestNotificationPermission() {

  if (!('Notification' in window)) {
    console.log(
      'このブラウザは通知に対応していません。'
    );
    return;
  }

  if (!('serviceWorker' in navigator)) {
    console.log(
      'Service Workerに対応していません。'
    );
    return;
  }

  if (!currentUser) {
    console.log(
      'ログインユーザーがいません。'
    );
    return;
  }

  // 通知が拒否されている場合
  if (Notification.permission === 'denied') {
    console.log(
      '通知が拒否されています。'
    );
    return;
  }

  // 通知許可を取得
  let permission =
    Notification.permission;

  if (permission !== 'granted') {

    permission =
      await Notification.requestPermission();

    console.log(
      '通知許可状態:',
      permission
    );
  }

  // 許可されなかった場合
  if (permission !== 'granted') {
    return;
  }

  try {

    // Service Workerを取得
    const registration =
      await navigator.serviceWorker.ready;

    // 既存のPush購読を確認
    let subscription =
      await registration.pushManager
        .getSubscription();

    // まだ購読していなければ作成
    if (!subscription) {

      const applicationServerKey =
        urlBase64ToUint8Array(
          VAPID_PUBLIC_KEY
        );

      subscription =
        await registration.pushManager
          .subscribe({
            userVisibleOnly: true,
            applicationServerKey:
              applicationServerKey
          });
    }

    // Push購読情報をJSON化
    const subscriptionJson =
      subscription.toJSON();

    const endpoint =
      subscriptionJson.endpoint;

    const p256dh =
      subscriptionJson.keys &&
      subscriptionJson.keys.p256dh;

    const auth =
      subscriptionJson.keys &&
      subscriptionJson.keys.auth;

    // 必要な情報が取得できなかった場合
    if (
      !endpoint ||
      !p256dh ||
      !auth
    ) {

      console.error(
        'Push購読情報が取得できませんでした。',
        subscriptionJson
      );

      return;
    }

    // Supabaseへ保存
    const {
      error
    } =
      await supabaseClient
        .from('push_subscriptions')
        .upsert(
          {
            user_id:
              currentUser.user_id,

            endpoint:
              endpoint,

            p256dh:
              p256dh,

            auth:
              auth,

            created_at:
              new Date().toISOString()
          },
          {
            onConflict:
              'user_id,endpoint'
          }
        );

    if (error) {

      console.error(
        'Push購読保存エラー:',
        error
      );

      return;
    }

    console.log(
      'Push購読登録成功'
    );

  } catch (error) {

    console.error(
      'Push通知登録エラー:',
      error
    );
  }
}


// ==================================================
// Base64 → Uint8Array
// ==================================================

function urlBase64ToUint8Array(
  base64String
) {

  const padding =
    '='.repeat(
      (4 - base64String.length % 4) % 4
    );

  const base64 =
    (
      base64String +
      padding
    )
      .replace(
        /-/g,
        '+'
      )
      .replace(
        /_/g,
        '/'
      );

  const rawData =
    window.atob(base64);

  const outputArray =
    new Uint8Array(
      rawData.length
    );

  for (
    let i = 0;
    i < rawData.length;
    ++i
  ) {

    outputArray[i] =
      rawData.charCodeAt(i);
  }

  return outputArray;
}
