import { expect, test } from '@playwright/test';

function realtimeReplyCategory(response) {
  const reason = [response?.response?.reason, response?.response?.message,
    response?.reason, response?.message]
    .filter((value) => typeof value === 'string').join(' ').toLowerCase();
  if (/permission denied|insufficient privilege/.test(reason)) return 'database-permission';
  if (/policy|row.level|rls/.test(reason)) return 'rls-policy';
  if (/jwt|token|claims/.test(reason)) return 'session-token';
  if (/unauthori[sz]ed|forbidden|not allowed/.test(reason)) return 'realtime-authorization';
  if (/private|public channel/.test(reason)) return 'channel-mode';
  return 'unknown';
}

function watchMentionSubscription(page, user) {
  let resolveReady;
  let ready = false;
  let replyStatus = null;
  let privateChannelReplies = 0;
  let expectedTopicReply = false;
  let replyCategory = 'unknown';
  let organizationTopicStatus = 'no-reply';
  let organizationTopicCategory = 'unknown';
  const subscribed = new Promise((resolve) => { resolveReady = resolve; });
  const expectedTopic = `realtime:organization:${user.org}:user:${user.id}`;
  const organizationTopic = `realtime:organization:${user.org}`;
  const onWebSocket = (socket) => {
    if (!socket.url().includes('/realtime/v1/websocket')) return;
    socket.on('framereceived', ({ payload }) => {
      try {
        const frame = JSON.parse(Buffer.isBuffer(payload) ? payload.toString('utf8') : payload);
        const [, , topic, event, response] = Array.isArray(frame)
          ? frame
          : [frame.join_ref, frame.ref, frame.topic, frame.event, frame.payload];
        if (event === 'phx_reply' && typeof topic === 'string' && topic.includes(':user:')) {
          privateChannelReplies += 1;
        }
        if (topic === organizationTopic && event === 'phx_reply') {
          organizationTopicStatus = response?.status ?? 'unknown';
          organizationTopicCategory = realtimeReplyCategory(response);
        }
        if (topic === expectedTopic && event === 'phx_reply') {
          expectedTopicReply = true;
          if (!ready) {
            ready = true;
            replyStatus = response?.status ?? 'unknown';
            replyCategory = realtimeReplyCategory(response);
            resolveReady(replyStatus);
          }
        }
      } catch { /* Ignore unrelated Realtime frames. */ }
    });
  };
  page.on('websocket', onWebSocket);
  return {
    async wait() {
      let timer;
      try {
        if (!ready) {
          replyStatus = await Promise.race([
            subscribed,
            new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Private mention channel did not subscribe.')), 15_000); }),
          ]);
        }
        if (replyStatus !== 'ok') {
          throw new Error(`Private mention channel rejected (status=${replyStatus ?? 'unknown'}, category=${replyCategory}, organization channel=${organizationTopicStatus}/${organizationTopicCategory}).`);
        }
      } catch (error) {
        if (error?.message === 'Private mention channel did not subscribe.') {
          throw new Error(`Private mention channel did not subscribe (private replies=${privateChannelReplies}, expected topic replied=${expectedTopicReply}).`);
        }
        throw error;
      } finally {
        clearTimeout(timer);
        page.off('websocket', onWebSocket);
      }
    },
  };
}

test('real database events deliver mentions, recover offline and enforce isolation', async ({ browser, request }) => {
  test.setTimeout(180_000);
  if (!process.env.GLL_NOTIFICATION_FIXTURE) throw new Error('Run through the homolog fixture workflow.');
  const fixture = JSON.parse(process.env.GLL_NOTIFICATION_FIXTURE);
  const base = process.env.GLL_E2E_BASE_URL;
  if (base !== 'https://www.xn--licigesto-s2a.com.br/homolog/') throw new Error('Homolog only.');
  const contexts = [], sessions = [];
  let config;
  async function login(index, route = '') {
    const context = await browser.newContext(); contexts.push(context);
    const page = await context.newPage();
    const mentionSubscription = watchMentionSubscription(page, fixture.users[index]);
    await page.goto(base + route);
    config = await page.evaluate(() => window.GLL_CONFIG);
    if (config.environment !== 'homolog' || new URL(config.supabaseUrl).hostname !== 'dwotbzrjcetizyygzoty.supabase.co') throw new Error('Wrong environment.');
    await page.locator('#loginEmail').fill(fixture.users[index].email);
    await page.locator('#loginPassword').fill(fixture.users[index].password);
    const response = page.waitForResponse((r) => r.url().includes('/auth/v1/token') && r.request().method() === 'POST');
    await page.locator('#loginForm button[type=submit]').click();
    const auth = await response;
    if (!auth.ok()) throw new Error(`Synthetic login ${index} failed (${auth.status()}).`);
    sessions[index] = await auth.json();
    await expect(page.locator('#appView')).toBeVisible({timeout:45_000});
    await expect(page.locator('#blockingLoadingModal')).not.toBeVisible({timeout:45_000});
    const authProbe = await request.post(config.supabaseUrl + '/rest/v1/rpc/list_bid_message_notifications', {
      headers: { apikey: config.supabaseAnonKey, Authorization: `Bearer ${sessions[index].access_token}` },
      data: {},
    });
    if (!authProbe.ok()) throw new Error(`Synthetic notification auth probe failed (${authProbe.status()}).`);
    const organizationProbe = await request.post(config.supabaseUrl + '/rest/v1/rpc/current_organization_id', {
      headers: { apikey: config.supabaseAnonKey, Authorization: `Bearer ${sessions[index].access_token}` },
      data: {},
    });
    if (!organizationProbe.ok() || await organizationProbe.json() !== fixture.users[index].org) {
      throw new Error('Synthetic organization session probe did not match the fixture.');
    }
    await mentionSubscription.wait();
    return page;
  }
  async function api(index, path, body) {
    const response = await request.fetch(config.supabaseUrl + '/rest/v1/' + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { apikey: config.supabaseAnonKey, Authorization: `Bearer ${sessions[index].access_token}` },
      ...(body === undefined ? {} : {data:body}),
    });
    if (!response.ok()) throw new Error(`Synthetic API ${path.split('?')[0]} failed (${response.status()}).`);
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }
  async function send(mention = true) {
    const label = '@' + fixture.users[1].name;
    return api(0,'rpc/create_bid_process_message', {p_bid_id:fixture.bid,
      p_body: mention ? `${label} synthetic notification` : 'Synthetic ordinary message',
      p_mentions: mention ? [{user_id:fixture.users[1].id,start_offset:0,end_offset:Array.from(label).length}] : []});
  }
  try {
    const recipient = await login(1);
    await expect.poll(async () => api(1,'rpc/list_bid_message_notifications',{})).toEqual([]);
    const author = await login(0,`?page=itens&licitacao=${encodeURIComponent(fixture.bid)}`);
    // A real second authenticated session sends the product RPC; no client Broadcast is sent.
    const requestStartedAt = Date.now();
    const messageId = await send();
    const confirmedAt = Date.now();
    await expect(recipient.locator('#toast')).toBeVisible({timeout:10_000});
    await expect(recipient.locator('#toastMessage')).toContainText('Você foi mencionado');
    const elapsed = Date.now() - confirmedAt;
    console.log(`Synthetic message RPC confirmed in ${confirmedAt - requestStartedAt} ms; mention toast arrived ${elapsed} ms after confirmation (target <= 2000 ms).`);
    expect(elapsed, 'Healthy-connection mention latency').toBeLessThanOrEqual(2000);
    await recipient.locator('#notificationsButton').click();
    await recipient.locator(`[data-notification-message="${messageId}"]`).click();
    await expect(recipient.locator('#bidFollowupDrawer')).toBeVisible();
    await expect(recipient.locator(`[data-message-id="${messageId}"]`)).toBeVisible();
    await expect(recipient.locator('#toast')).not.toBeVisible({timeout:6000});
    const ordinaryId = await send(false);
    await expect(recipient.locator(`[data-message-id="${ordinaryId}"]`)).toBeVisible({timeout:5000});
    await expect(recipient.locator('#toast')).not.toBeVisible();
    // New mention must remain visible over a modal.
    await send();
    await expect(recipient.locator('#bidFollowupDrawer #toast')).toBeVisible({timeout:5000});
    await expect(recipient.locator('#toast')).not.toBeVisible({timeout:6000});
    await recipient.locator('#closeBidFollowupButton').click();
    await recipient.context().setOffline(true);
    const recoveredId = await send();
    await recipient.context().setOffline(false);
    await recipient.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect(recipient.locator('#toast')).toBeVisible({timeout:15000});
    await recipient.locator('#notificationsButton').click();
    await expect(recipient.locator(`[data-notification-message="${recoveredId}"]`)).toBeVisible();
    await expect(recipient.locator('#toast')).not.toBeVisible({timeout:6000});
    await recipient.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect.poll(async () => (await api(1,'rpc/list_bid_message_notifications',{})).length).toBe(3);
    await expect(recipient.locator('#toast')).not.toBeVisible();
    // General chat Broadcast includes created_at and survives the account-history filter.
    await api(0,'organization_messages',{organization_id:fixture.org,sender_id:fixture.users[0].id,body:'Synthetic general chat'});
    await expect(recipient.locator('#organizationChatUnreadCount')).toHaveText('1',{timeout:5000});
    // Unauthorized profiles use the real API under their own sessions.
    for (const i of [2,3]) {
      await login(i);
      expect(await api(i,`bid_process_messages?select=id&bid_id=eq.${fixture.bid}`)).toEqual([]);
      expect(await api(i,'rpc/list_bid_message_notifications',{})).toEqual([]);
      expect(await api(i,'rpc/has_unread_bid_process_messages',{p_bid_id:fixture.bid})).toBe(false);
    }
    await author.locator('#bidFollowupButton').click();
    await author.locator('#bidFollowupInput').fill('Synthetic UI send');
    await author.locator('#bidFollowupInput').press('Enter');
    await expect(author.locator('#bidFollowupMessages')).toContainText('Synthetic UI send');
    console.log('Two-session delivery, modal toast, ordinary messages, recovery and isolation verified.');
  } finally {
    if (config) for (const session of sessions.filter(Boolean)) {
      await request.post(config.supabaseUrl + '/auth/v1/logout', {headers:{apikey:config.supabaseAnonKey,Authorization:`Bearer ${session.access_token}`}}).catch(() => {});
    }
    await Promise.all(contexts.map((context) => context.close()));
  }
});
