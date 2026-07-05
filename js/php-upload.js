// js/php-upload.js
// Small helper to upload files to the PHP backend created at /server/upload.php

export async function uploadToPhp(files, caption = '', date = '') {
  const form = new FormData();
  for (let i = 0; i < files.length; i++) form.append('files[]', files[i]);
  form.append('caption', caption);
  form.append('date', date || new Date().toISOString().split('T')[0]);

  const res = await fetch('/server/upload.php', {
    method: 'POST',
    body: form
  });
  return res.json();
}
