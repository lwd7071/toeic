async page => {
  const base = 'http://localhost:3000';
  async function login(email) {
    await page.goto(base);
    const me = await (await page.request.get(`${base}/api/me`)).json();
    if (me.user?.email === email) return;
    await page.context().clearCookies();
    await page.goto(base);
    const popupPromise = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    const popup = await popupPromise;
    if (await popup.getByText(email, { exact: true }).count()) {
      await popup.getByText(email, { exact: true }).click();
    } else {
      await popup.getByRole('button', { name: 'Add new account' }).click();
      await popup.getByRole('button', { name: 'Back' }).waitFor();
      await popup.getByRole('textbox').first().fill(email);
      await popup.getByRole('button', { name: 'Sign in with Google.com' }).click();
    }
    await page.waitForURL('**/learn', { timeout: 15000 });
  }
  await login('admin@example.com');
  await page.goto(`${base}/admin`);
  await page.getByRole('button', { name: 'Tạo chủ đề' }).click();
  await page.getByRole('textbox', { name: 'Tên', exact: true }).fill('Công sở');
  await page.getByRole('button', { name: 'Tạo mới' }).click();
  await page.getByRole('button', { name: 'Chọn file CSV' }).setInputFiles('D:/toeic/examples/vocabulary.csv');
  await page.getByRole('button', { name: 'Xem trước file' }).click();
  await page.getByRole('button', { name: 'Xác nhận nhập 3 mục' }).click();
  await page.getByRole('button', { name: 'Bài ngữ pháp' }).click();
  await page.getByRole('button', { name: 'Tạo bài học' }).click();
  await page.getByRole('textbox', { name: 'Tên', exact: true }).fill('Bài danh từ');
  await page.getByRole('textbox', { name: 'Lý thuyết (Markdown cơ bản)' }).fill('## Danh từ\nDanh từ gọi tên người hoặc vật.');
  await page.getByRole('button', { name: 'Tạo mới' }).click();
  await page.getByRole('button', { name: 'Chọn file CSV' }).setInputFiles('D:/toeic/examples/grammar.csv');
  await page.getByRole('button', { name: 'Xem trước file' }).click();
  await page.getByRole('button', { name: 'Xác nhận nhập 2 mục' }).click();
  await page.goto(`${base}/learn/vocabulary`);
  await page.getByRole('link', { name: /Công sở 3 thẻ/ }).click();
  await page.getByRole('button', { name: 'Chưa nhớ' }).click();
  await page.getByRole('button', { name: 'Cần ôn (1)' }).waitFor();
  const cardUrl = page.url();
  await page.goto(`${base}/learn/grammar`);
  await page.getByRole('link', { name: /Bài danh từ 2 câu hỏi/ }).click();
  await page.getByRole('button', { name: 'Bắt đầu luyện tập' }).click();
  await page.waitForURL('**/learn/quiz/**');
  await page.getByRole('button', { name: 'A review' }).click();
  await page.getByText('Chủ ngữ số ít ở thì hiện tại đơn dùng động từ thêm s.').waitFor();
  await page.getByRole('button', { name: 'Câu tiếp theo' }).click();
  await page.reload();
  await page.getByText('Câu 2 / 2').waitFor();
  await page.getByRole('button', { name: 'C by' }).click();
  await page.getByRole('button', { name: 'Xem kết quả' }).click();
  await page.getByText('1/2', { exact: true }).waitFor();
  const historyUrl = page.url();
  await page.goto(`${base}/admin`);
  const content = await (await page.request.get(`${base}/api/admin/content`)).json();
  const lesson = content.lessons.find(item => item.title === 'Bài danh từ');
  if (!lesson) throw new Error('Bài học vừa tạo không tồn tại.');
  const csrf = await (await page.request.get(`${base}/api/auth/csrf`)).json();
  const archive = await page.request.patch(`${base}/api/admin/content/lesson/${lesson.id}`, {
    data: { archive: true },
    headers: { origin: base, 'x-csrf-token': csrf.token },
  });
  if (!archive.ok()) throw new Error(`Ẩn bài thất bại: ${archive.status()}`);
  const home = await (await page.request.get(`${base}/api/home`)).json();
  if (home.lessons.some(item => item.id === lesson.id)) throw new Error('Bài đã ẩn vẫn hiện ở trang học.');
  await page.goto(historyUrl);
  await page.getByText('Chủ ngữ số ít ở thì hiện tại đơn dùng động từ thêm s.').waitFor();
  await page.getByRole('button', { name: 'Đăng xuất' }).click();
  await page.waitForURL(base + '/');
  await login('student@example.com');
  await page.goto(`${base}/admin`);
  await page.waitForURL('**/learn');
  const adminResponse = await page.request.get(`${base}/api/admin/content`);
  if (adminResponse.status() !== 403) throw new Error('Học viên vẫn truy cập được API quản trị.');
  await page.goto(cardUrl);
  await page.getByRole('button', { name: 'Cần ôn (0)' }).waitFor();
  return { historyAfterArchive: true, studentAdminStatus: adminResponse.status(), studentProgressIsolated: true };
}
