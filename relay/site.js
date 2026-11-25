// Replace this one value with the direct Mega link for Relay-Setup-1.0.0.exe.
const relayDownloadUrl ='https://mega.nz/file/oUwhRLqL#ew9flM4auPPpRE6mRlflJB3VJPdeT-aFE4TpJfuiry4';
document.querySelectorAll('[data-download]').forEach(link=>link.href=relayDownloadUrl);

// Keep every destination in one compact top navigation bar.
document.querySelectorAll('.top-links').forEach(nav=>{
  if(nav.querySelector('[href="privacy.html"]'))return;
  const privacy=document.createElement('a');
  privacy.href='privacy.html';privacy.textContent='Privacy';
  nav.insertBefore(privacy,nav.querySelector('[data-download]'));
});
