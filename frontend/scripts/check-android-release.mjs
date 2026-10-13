import fs from 'node:fs';
const mode=process.argv.includes('--development')?'development':'production';
if(mode==='production') {
  const api=process.env.VITE_API_URL;
  if(!api||!/^https:\/\//.test(api)||/localhost|127\.0\.0\.1|\.invalid|example\./i.test(api))throw new Error('Set a real production HTTPS VITE_API_URL before building Android');
  if(process.env.APP_PUBLISHING_APPROVED!=='true')throw new Error('Complete and review App publishing details and set APP_PUBLISHING_APPROVED=true');
  if(!process.env.ANDROID_APP_ID||!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){2,}$/.test(process.env.ANDROID_APP_ID))throw new Error('Confirm your Android package namespace in ANDROID_APP_ID');
  const gradle=fs.readFileSync('android/app/build.gradle','utf8');
  if(!gradle.includes('applicationId "'+process.env.ANDROID_APP_ID+'"'))throw new Error('Android namespace differs from Gradle applicationId. Rename native sources and Gradle before release');
}
if(!fs.existsSync('android/app/src/main/AndroidManifest.xml'))throw new Error('Initialize Android using npx cap add android');
console.log('Android input checks passed; signed AAB, device testing and Play review remain separate gates.');
