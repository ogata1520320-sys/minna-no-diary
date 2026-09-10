const SUPABASE_URL = 'https://hwadprvpvxtbiiuvpsso.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_ydrTup3LoNdul7KeXWVwwg_raIcSjFy';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
});

const $ = id => document.getElementById(id);
const loginScreen = $('login-screen');
const homeScreen = $('home-screen');
const loginForm = $('login-form');
const loginMessage = $('login-message');
const welcomeMessage = $('welcome-message');
const logoutButton = $('logout-button');
const registerOpenButton = $('register-open-button');
const registerModal = $('register-modal');
const registerForm = $('register-form');
const registerMessage = $('register-message');
const registerCancelButton = $('register-cancel-button');
const diaryPageTitle = $('diary-page-title');
const diaryList = $('diary-list');
const diaryMessage = $('diary-message');
const allDiariesButton = $('all-diaries-button');
const myDiariesButton = $('my-diaries-button');
const draftsButton = $('drafts-button');
const newDiaryButton = $('new-diary-button');
const homeUserCard = $('home-user-card');
const notificationSection = $('notification-section');
const notificationList = $('notification-list');
const notificationCountLabel = $('notification-count-label');
const diaryDetailHeader = $('diary-detail-header');
const diaryDetailHeaderTitle = $('diary-detail-header-title');
const diaryDetailHeaderMeta = $('diary-detail-header-meta');
const diaryDetail = $('diary-detail');
const diaryDetailContent = $('diary-detail-content');
const diaryDetailBack = $('diary-detail-back');
const diaryEditButton = $('diary-edit-button');
const diaryDeleteButton = $('diary-delete-button');
const diaryEditor = $('diary-editor');
const diaryEditorBack = $('diary-editor-back');
const diaryEditorTitle = $('diary-editor-title');
const diaryTitleInput = $('diary-title-input');
const diaryContentInput = $('diary-content-input');
const diaryEditorMessage = $('diary-editor-message');
const diarySaveDraftButton = $('diary-save-draft-button');
const diaryPublishButton = $('diary-publish-button');
const commentsSection = $('comments-section');
const commentList = $('comment-list');
const commentOpenButton = $('comment-open-button');
const commentForm = document.querySelector('.comment-form');
const commentInput = $('comment-input');
const commentMessage = $('comment-message');
const commentSubmitButton = $('comment-submit-button');
const commentCancelButton = $('comment-cancel-button');

let currentUser = null;
let currentDiaryId = null;
let currentEditingDiaryId = null;
let replyingToCommentId = null;
let currentDiaryFilter = 'all';

function generateId() {
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 12);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[c]);
}

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('ja-JP', { year:'numeric', month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' });
}

function contentJsonToText(value) {
  if (Array.isArray(value)) return value.map(x => x?.text ?? '').join('');
  if (typeof value === 'string') {
    try { return contentJsonToText(JSON.parse(value)); } catch (_) { return value; }
  }
  if (value && typeof value === 'object') return value.text ?? '';
  return '';
}

function showLogin() {
  loginScreen.classList.remove('hidden');
  homeScreen.classList.add('hidden');
  logoutButton?.classList.add('hidden');
  if (registerModal) registerModal.classList.add('hidden');
}

function closeRegister() {
  if (registerModal) registerModal.classList.add('hidden');
  if (registerForm) registerForm.reset();
  if (registerMessage) registerMessage.textContent = '';
}

function openRegister() {
  if (!registerModal) return;
  registerModal.classList.remove('hidden');
  $('register-user-id')?.focus();
}

registerOpenButton?.addEventListener('click', openRegister);
registerCancelButton?.addEventListener('click', closeRegister);

async function setReturnedSession(result) {
  const session = result?.session || (result?.access_token && result?.refresh_token ? result : null);
  if (!session?.access_token || !session?.refresh_token) throw new Error('ログインセッションを取得できませんでした。');
  const { error } = await supabaseClient.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
  if (error) throw error;
}

loginForm.addEventListener('submit', async e => {
  e.preventDefault();
  const userId = $('user-id').value.trim();
  const password = $('password').value;
  if (!userId || !password) { loginMessage.textContent = 'IDとパスワードを入力してください。'; return; }
  const button = loginForm.querySelector('button[type="submit"]');
  button.disabled = true;
  loginMessage.textContent = 'ログインしています…';
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/legacy-login`, {
      method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ userId, password })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) throw new Error(result.error || 'IDまたはパスワードが違います。');
    await setReturnedSession(result);
    $('password').value = '';
    loginMessage.textContent = '';
    await checkLogin();
  } catch (err) {
    console.error(err);
    loginMessage.textContent = err.message || 'ログインに失敗しました。';
  } finally { button.disabled = false; }
});

registerForm?.addEventListener('submit', async e => {
  e.preventDefault();
  const userId = $('register-user-id').value.trim();
  const password = $('register-password').value;
  const password2 = $('register-password-confirm').value;
  const name = $('register-name').value.trim();
  if (password !== password2) { registerMessage.textContent = 'パスワードが一致しません。'; return; }
  const button = registerForm.querySelector('button[type="submit"]');
  button.disabled = true; registerMessage.textContent = 'アカウントを作成しています…';
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/legacy-register`, {
      method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ userId, password, name })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) throw new Error(result.error || 'アカウント作成に失敗しました。');
    await setReturnedSession(result);
    closeRegister();
    await checkLogin();
  } catch (err) {
    console.error(err);
    registerMessage.textContent = err.message || 'アカウント作成に失敗しました。';
  } finally { button.disabled = false; }
});

async function checkLogin() {
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) { console.error(error); showLogin(); return; }
  const session = data.session;
  if (!session) { showLogin(); return; }
  if (session.user?.app_metadata?.provider === 'github') { await supabaseClient.auth.signOut(); showLogin(); return; }
  await showHome(session.user);
}

async function showHome(authUser) {
  const { data:user, error } = await supabaseClient.from('users').select('user_id,name,active,email,auth_user_id').eq('auth_user_id', authUser.id).maybeSingle();
  if (error || !user) { console.error(error); showLogin(); loginMessage.textContent = 'ユーザー情報の取得に失敗しました。'; return; }
  if (!user.active) { await supabaseClient.auth.signOut(); showLogin(); loginMessage.textContent = 'このアカウントは現在無効になっています。'; return; }
  currentUser = user;
  loginScreen.classList.add('hidden'); homeScreen.classList.remove('hidden');
  logoutButton?.classList.remove('hidden');
  welcomeMessage.textContent = `${user.name}さん、ようこそ！`;
  showDiaryHome();
  await loadNotifications();
  await loadDiaries('all');
}

logoutButton.addEventListener('click', async () => {
  if (!confirm('ログアウトしますか？')) return;
  await supabaseClient.auth.signOut();
  currentUser = null; currentDiaryId = null; currentEditingDiaryId = null;
  showLogin();
});

async function loadNotifications() {
  if (!notificationList || !currentUser) return;
  notificationList.innerHTML = '<p class="message">通知を読み込んでいます…</p>';
  const { data, error } = await supabaseClient
    .from('notifications')
    .select('notification_id,type,diary_id,comment_id,from_user_id,message,created_at')
    .eq('user_id', currentUser.user_id)
    .order('created_at', { ascending: false })
    .limit(5);
  if (error) {
    console.error(error);
    notificationList.innerHTML = '<p class="message">通知を取得できませんでした。</p>';
    if (notificationCountLabel) notificationCountLabel.textContent = '';
    return;
  }
  const notifications = data || [];
  if (notificationCountLabel) notificationCountLabel.textContent = notifications.length ? `最新${notifications.length}件` : '';
  if (!notifications.length) {
    notificationList.innerHTML = '<p class="message">新しい通知はありません。</p>';
    return;
  }
  notificationList.innerHTML = '';
  notifications.forEach(n => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'notification-item';
    item.innerHTML = `<span class="notification-icon">🔔</span><span class="notification-main"><span class="notification-message">${escapeHtml(n.message || 'コメント・返信がありました。')}</span><span class="notification-time">${formatDate(n.created_at)}</span></span>`;
    if (n.diary_id) item.addEventListener('click', () => openDiary(n.diary_id));
    notificationList.appendChild(item);
  });
}

async function createNotificationForComment(comment) {
  try {
    const { data: diary, error: diaryError } = await supabaseClient
      .from('diaries')
      .select('diary_id,user_id,title')
      .eq('diary_id', comment.diary_id)
      .maybeSingle();
    if (diaryError || !diary) return;

    let targetUserId = diary.user_id;
    let message = `${currentUser.name || currentUser.user_id}さんが「${diary.title || '無題'}」にコメントしました。`;

    if (comment.parent_comment_id) {
      const { data: parent, error: parentError } = await supabaseClient
        .from('comments')
        .select('user_id')
        .eq('comment_id', comment.parent_comment_id)
        .maybeSingle();
      if (!parentError && parent?.user_id) {
        targetUserId = parent.user_id;
        message = `${currentUser.name || currentUser.user_id}さんがあなたのコメントに返信しました。`;
      }
    }

    if (!targetUserId || targetUserId === currentUser.user_id) return;

    const { error } = await supabaseClient.from('notifications').insert({
      notification_id: generateId(),
      user_id: targetUserId,
      type: comment.parent_comment_id ? 'reply' : 'comment',
      diary_id: comment.diary_id,
      comment_id: comment.comment_id,
      from_user_id: currentUser.user_id,
      message,
      created_at: new Date().toISOString(),
      read: false
    });
    if (error) console.error('通知作成エラー:', error);
  } catch (e) {
    console.error('通知作成エラー:', e);
  }
}

function showDiaryHome() {
  homeUserCard.classList.remove('hidden'); diaryPageTitle.classList.remove('hidden'); diaryList.classList.remove('hidden');
  diaryDetailHeader.classList.add('hidden'); diaryDetail.classList.add('hidden'); diaryEditor.classList.add('hidden');
  allDiariesButton.classList.remove('hidden'); myDiariesButton.classList.remove('hidden'); draftsButton?.classList.remove('hidden');
  setActiveDiaryTab(currentDiaryFilter);
  diaryEditButton?.classList.add('hidden'); diaryDeleteButton?.classList.add('hidden');
  commentsSection?.classList.add('hidden'); closeCommentForm();
  notificationSection?.classList.remove('hidden');
}

function hideDiaryControls() {
  document.querySelector('.diary-controls')?.classList.add('hidden');
}

function showDiaryControls() {
  document.querySelector('.diary-controls')?.classList.remove('hidden');
}

function setActiveDiaryTab(filter) {
  const buttons = { all: allDiariesButton, mine: myDiariesButton, drafts: draftsButton };
  Object.entries(buttons).forEach(([key, button]) => {
    if (!button) return;
    const active = key === filter;
    button.classList.toggle('active-tab', active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
  });
}

async function loadDiaries(filter='all') {
  showDiaryControls();
  currentDiaryFilter = filter;
  setActiveDiaryTab(filter);
  diaryMessage.textContent = '';
  diaryList.setAttribute('aria-busy', 'true');
  let query = supabaseClient.from('diaries').select('diary_id,user_id,name,title,status,content_json,created_at,updated_at,published_at').order('updated_at',{ascending:false}).limit(100);
  if (filter === 'mine' || filter === 'drafts') query = query.eq('user_id', currentUser.user_id);
  const { data, error } = await query;
  if (error) { console.error(error); diaryMessage.textContent = '日記の取得に失敗しました。'; diaryList.removeAttribute('aria-busy'); return; }
  const visible = (data || []).filter(d => d.status === 'published' || d.user_id === currentUser.user_id).filter(d => filter !== 'drafts' || d.status === 'draft');
  diaryList.removeAttribute('aria-busy');
  diaryMessage.textContent = '';
  diaryList.innerHTML = '';
  if (!visible.length) { diaryList.innerHTML = '<p class="message">日記がありません。</p>'; return; }
  visible.forEach(diary => {
    const item = document.createElement('article'); item.className='diary-item'; item.tabIndex=0;
    item.innerHTML = `<p class="diary-title">${escapeHtml(diary.title || '無題')}</p><p class="diary-meta">名前：${escapeHtml(diary.name || diary.user_id)}</p><p class="diary-meta">更新日時：${formatDate(diary.updated_at)}</p>${diary.status==='draft'?'<span class="diary-status">下書き</span>':''}`;
    item.addEventListener('click',()=>openDiary(diary.diary_id)); item.addEventListener('keydown',e=>{if(e.key==='Enter')openDiary(diary.diary_id)});
    diaryList.appendChild(item);
  });
}

allDiariesButton.addEventListener('click', async()=>{showDiaryHome(); await loadDiaries('all');});
myDiariesButton.addEventListener('click', async()=>{showDiaryHome(); await loadDiaries('mine');});
draftsButton?.addEventListener('click', async()=>{showDiaryHome(); await loadDiaries('drafts');});

async function openDiary(diaryId) {
  currentDiaryId = diaryId; closeCommentForm(); replyingToCommentId=null;
  const { data, error } = await supabaseClient.from('diaries').select('diary_id,user_id,name,title,status,content_json,created_at,updated_at,published_at').eq('diary_id',diaryId).maybeSingle();
  if (error || !data) { console.error(error); alert('日記を取得できませんでした。'); return; }
  if (data.status !== 'published' && data.user_id !== currentUser.user_id) { alert('日記が見つかりません。'); return; }
  homeUserCard.classList.add('hidden'); notificationSection?.classList.add('hidden'); diaryPageTitle.classList.add('hidden'); diaryList.classList.add('hidden'); hideDiaryControls(); diaryDetailHeader.classList.remove('hidden'); diaryDetail.classList.remove('hidden'); diaryEditor.classList.add('hidden');
  diaryDetailHeaderTitle.textContent=data.title || '無題';
  diaryDetailHeaderMeta.innerHTML=`<div class="detail-meta-item"><span class="detail-meta-label">名前</span><span class="detail-meta-value">${escapeHtml(data.name || data.user_id)}</span></div><div class="detail-meta-item"><span class="detail-meta-label">日時</span><span class="detail-meta-value">${formatDate(data.updated_at)}</span></div><div class="detail-meta-item"><span class="detail-meta-label">状態</span><span class="detail-meta-value">${data.status==='draft'?'下書き':'公開'}</span></div>`;
  diaryDetailContent.textContent=contentJsonToText(data.content_json);
  const own = currentUser && data.user_id === currentUser.user_id;
  diaryEditButton?.classList.toggle('hidden', !own); diaryDeleteButton?.classList.toggle('hidden', !own);
  commentsSection?.classList.toggle('hidden', data.status !== 'published');
  if (data.status === 'published') await loadComments(diaryId);
}

function startEditor(data=null) {
  currentEditingDiaryId = data?.diary_id || null;
  homeUserCard.classList.add('hidden'); notificationSection?.classList.add('hidden'); diaryPageTitle.classList.add('hidden'); diaryList.classList.add('hidden'); diaryDetailHeader.classList.add('hidden'); diaryDetail.classList.add('hidden'); hideDiaryControls(); commentsSection?.classList.add('hidden'); closeCommentForm();
  diaryEditor.classList.remove('hidden'); diaryEditorTitle.textContent=data?'日記を編集':'新しい日記'; diaryTitleInput.value=data?.title||''; diaryContentInput.value=data?contentJsonToText(data.content_json):''; diaryEditorMessage.textContent='';
}

diaryEditButton?.addEventListener('click', async()=>{
  if (!currentDiaryId || !currentUser) return;
  const { data,error } = await supabaseClient.from('diaries').select('diary_id,user_id,title,content_json,status').eq('diary_id',currentDiaryId).eq('user_id',currentUser.user_id).maybeSingle();
  if (error || !data) { alert('日記を編集できませんでした。'); return; }
  startEditor(data);
});

diaryDeleteButton?.addEventListener('click', async()=>{
  if (!currentDiaryId || !currentUser || !confirm('この日記を削除しますか？\nコメントも削除されます。')) return;
  diaryDeleteButton.disabled=true;
  try {
    const { error } = await supabaseClient.from('diaries').delete().eq('diary_id',currentDiaryId).eq('user_id',currentUser.user_id);
    if (error) throw error;
    currentDiaryId=null; showDiaryHome(); await loadDiaries(currentDiaryFilter==='drafts'?'drafts':'all');
  } catch(e) { console.error(e); alert('日記の削除に失敗しました。'); }
  finally { diaryDeleteButton.disabled=false; }
});

diaryDetailBack.addEventListener('click', async()=>{currentDiaryId=null;showDiaryHome();await loadDiaries(currentDiaryFilter);});
newDiaryButton.addEventListener('click',()=>startEditor());
diaryEditorBack.addEventListener('click',async()=>{currentEditingDiaryId=null;showDiaryHome();await loadDiaries(currentDiaryFilter);});

async function saveDiary(status) {
  const title=diaryTitleInput.value.trim(); const body=diaryContentInput.value;
  if (status==='published' && !title) { diaryEditorMessage.textContent='タイトルを入力してください。'; return; }
  if (title.length>100) { diaryEditorMessage.textContent='タイトルは100文字以内にしてください。'; return; }
  if (body.length>30000) { diaryEditorMessage.textContent='本文は30,000文字以内にしてください。'; return; }
  if (status==='published' && !body.trim()) { diaryEditorMessage.textContent='本文を入力してください。'; return; }
  const button=status==='draft'?diarySaveDraftButton:diaryPublishButton; button.disabled=true; diaryEditorMessage.textContent='保存しています…';
  try {
    const now=new Date().toISOString(); const content_json=[{type:'text',text:body}]; let error;
    if (currentEditingDiaryId) {
      const patch={title,content_json,status,updated_at:now}; if(status==='published') patch.published_at=undefined;
      const result=await supabaseClient.from('diaries').update(patch).eq('diary_id',currentEditingDiaryId).eq('user_id',currentUser.user_id); error=result.error;
    } else {
      const row={diary_id:generateId(),user_id:currentUser.user_id,name:currentUser.name,title,content_json,status,created_at:now,updated_at:now}; if(status==='published') row.published_at=now;
      const result=await supabaseClient.from('diaries').insert(row); error=result.error;
    }
    if(error) throw error;
    const savedId=currentEditingDiaryId; currentEditingDiaryId=null;
    diaryEditorMessage.textContent=status==='draft'?'下書きを保存しました。':'公開しました。';
    if(status==='published' && savedId) { await openDiary(savedId); return; }
    showDiaryHome(); await loadDiaries(status==='draft'?'drafts':'all');
  } catch(e) { console.error(e); diaryEditorMessage.textContent='日記の保存に失敗しました。'; }
  finally { button.disabled=false; }
}

diarySaveDraftButton?.addEventListener('click',()=>saveDiary('draft'));
diaryPublishButton?.addEventListener('click',()=>saveDiary('published'));

commentOpenButton?.addEventListener('click',()=>openCommentForm());
commentCancelButton?.addEventListener('click',()=>closeCommentForm());
commentSubmitButton?.addEventListener('click',()=>submitComment());

function openCommentForm() {
  if (!commentForm) return;
  commentForm.classList.remove('hidden'); commentOpenButton.classList.add('hidden'); commentMessage.textContent=replyingToCommentId?'返信を書く':'コメントを書く'; commentInput.focus();
}
function closeCommentForm() {
  if (!commentForm) return;
  commentForm.classList.add('hidden'); commentOpenButton?.classList.remove('hidden'); commentInput.value=''; commentMessage.textContent=''; replyingToCommentId=null;
}

async function loadComments(diaryId) {
  if (!commentList) return;
  commentList.innerHTML='<p class="message">コメントを読み込んでいます…</p>';
  const { data,error }=await supabaseClient.from('comments').select('comment_id,diary_id,user_id,name,body,created_at,deleted,parent_comment_id').eq('diary_id',diaryId).order('created_at',{ascending:true});
  if(error){console.error(error);commentList.innerHTML='<p class="message">コメントを取得できませんでした。</p>';return;}
  const comments=(data||[]).filter(c=>!c.deleted);
  commentList.innerHTML='';
  if(!comments.length){commentList.innerHTML='<p class="message">まだコメントはありません。</p>';return;}
  const roots=comments.filter(c=>!c.parent_comment_id);
  roots.forEach(root=>renderCommentTree(root,comments,commentList,0));
}

function renderCommentTree(comment,all,parentElement,level) {
  const wrapper=document.createElement('div'); wrapper.className='comment-thread'; if(level) wrapper.classList.add('comment-reply-thread');
  const card=document.createElement('article'); card.className='comment-item';
  const replies=all.filter(c=>c.parent_comment_id===comment.comment_id);
  card.innerHTML=`<div class="comment-author">${escapeHtml(comment.name||comment.user_id)}</div><div class="comment-body">${escapeHtml(comment.body).replace(/\n/g,'<br>')}</div><div class="comment-date">${formatDate(comment.created_at)}</div><div class="comment-actions"></div>`;
  const actions=card.querySelector('.comment-actions');
  const reply=document.createElement('button'); reply.type='button'; reply.className='secondary-button comment-action-button'; reply.textContent='返信'; reply.addEventListener('click',()=>{replyingToCommentId=comment.comment_id;openCommentForm();commentMessage.textContent=`${comment.name||comment.user_id}さんへの返信`;}); actions.appendChild(reply);
  if(currentUser && comment.user_id===currentUser.user_id){const del=document.createElement('button');del.type='button';del.className='secondary-button comment-action-button';del.textContent='削除';del.addEventListener('click',()=>deleteComment(comment.comment_id));actions.appendChild(del);}
  wrapper.appendChild(card);
  if(replies.length){
    const toggle=document.createElement('button');toggle.type='button';toggle.className='reply-toggle';let expanded=false;toggle.textContent=`▶ 返信 ${replies.length}件`;
    const children=document.createElement('div');children.className='comment-replies hidden';
    toggle.addEventListener('click',()=>{expanded=!expanded;children.classList.toggle('hidden',!expanded);toggle.textContent=`${expanded?'▼':'▶'} 返信 ${replies.length}件`;});
    wrapper.appendChild(toggle); wrapper.appendChild(children); replies.forEach(r=>renderCommentTree(r,all,children,level+1));
  }
  parentElement.appendChild(wrapper);
}

async function submitComment() {
  if(!currentDiaryId||!currentUser)return;
  const body=commentInput.value.trim();
  if(!body){commentMessage.textContent='コメントを入力してください。';return;}
  if(body.length>1000){commentMessage.textContent='コメントは1〜1000文字で入力してください。';return;}
  commentSubmitButton.disabled=true; commentMessage.textContent='投稿しています…';
  try{
    const commentId=generateId();
    const {data:inserted,error}=await supabaseClient.from('comments').insert({comment_id:commentId,diary_id:currentDiaryId,user_id:currentUser.user_id,name:currentUser.name,body,parent_comment_id:replyingToCommentId||null,deleted:false}).select().single();
    if(error)throw error;
    await createNotificationForComment(inserted);
    await loadComments(currentDiaryId); closeCommentForm();
    await loadNotifications();
  }catch(e){console.error(e);commentMessage.textContent='コメントの投稿に失敗しました。';}
  finally{commentSubmitButton.disabled=false;}
}

async function deleteComment(commentId){
  if(!confirm('このコメントを削除しますか？'))return;
  const {error}=await supabaseClient.from('comments').update({deleted:true}).eq('comment_id',commentId);
  if(error){console.error(error);alert('コメントの削除に失敗しました。');return;}
  await loadComments(currentDiaryId);
}

window.addEventListener('DOMContentLoaded',checkLogin);
