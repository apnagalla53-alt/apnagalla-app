export function validateEnvironment(config: Record<string,any>) {
  const mode=config.NODE_ENV||'development';
  if(!['development','test','production'].includes(mode)) throw new Error('NODE_ENV must be development, test or production');
  if(!config.DATABASE_URL) throw new Error('DATABASE_URL is required');
  let database:URL;try{database=new URL(config.DATABASE_URL);}catch{throw new Error('DATABASE_URL must be a valid PostgreSQL URL');}
  if(!['postgres:','postgresql:'].includes(database.protocol)) throw new Error('DATABASE_URL must use PostgreSQL');
  if(mode==='production') {
    for(const key of ['JWT_SECRET','PLATFORM_JWT_SECRET']) {
      const value=config[key];
      if(typeof value!=='string'||value.length<48||new Set(value).size<12||/^(.*)\1{2,}$/.test(value)||/example|changeme|your_|password|secret123/i.test(value)) throw new Error(key+' must be a unique random secret of at least 48 characters');
    }
    if(config.JWT_SECRET===config.PLATFORM_JWT_SECRET) throw new Error('Platform and tenant JWT secrets must differ');
    if(config.PLATFORM_MFA_REQUIRED==='false')throw new Error('Platform MFA cannot be disabled in production');
    const mfaKey=Buffer.from(config.MFA_ENCRYPTION_KEY||'','base64');
    if(mfaKey.length!==32||new Set(mfaKey).size<12)throw new Error('MFA_ENCRYPTION_KEY must be a random 32-byte base64 key');
    for(const key of ['FRONTEND_ORIGIN','API_ORIGIN']) {
      let url:URL;try{url=new URL(config[key]);}catch{throw new Error(key+' is required as an HTTPS origin');}
      if(url.protocol!=='https:'||url.pathname!=='/'||url.search||url.hash||url.username||url.password||['localhost','127.0.0.1'].includes(url.hostname)) throw new Error(key+' must be a production HTTPS origin');
    }
    if(config.TENANT_BOOTSTRAP_PASSWORD||config.PLATFORM_BOOTSTRAP_PASSWORD) throw new Error('Automatic bootstrap passwords are forbidden in production; use the one-time admin CLI');
    if(!['local','s3','cloudinary'].includes(config.STORAGE_PROVIDER)) throw new Error('STORAGE_PROVIDER must be local, s3 or cloudinary');
    if(config.STORAGE_PROVIDER==='local'&&!config.UPLOAD_DIR) throw new Error('UPLOAD_DIR is required for persistent private storage');
    if(!config.BACKUP_PROVIDER) throw new Error('BACKUP_PROVIDER is required; use none when not configured');
    if(!config.APP_VERSION) throw new Error('APP_VERSION is required in production');
    if(config.TRUSTED_PROXY_CIDRS&&/(?:^|,)\s*(?:true|\*|0\.0\.0\.0\/0|::\/0)\s*(?:,|$)/i.test(config.TRUSTED_PROXY_CIDRS))throw new Error('TRUSTED_PROXY_CIDRS must list only the actual reverse proxy addresses.');
  }
  if(config.STORAGE_PROVIDER==='s3') for(const key of ['S3_BUCKET','S3_REGION']) if(!config[key])throw new Error(key+' is required for S3 storage');
  if(config.STORAGE_PROVIDER==='cloudinary') {
    for(const key of ['CLOUDINARY_CLOUD_NAME','CLOUDINARY_API_KEY','CLOUDINARY_API_SECRET']) if(typeof config[key]!=='string'||!config[key].trim())throw new Error(key+' is required for private Cloudinary storage');
    if(!/^[a-zA-Z0-9_-]+$/.test(config.CLOUDINARY_CLOUD_NAME))throw new Error('Invalid Cloudinary cloud name');
  }
  const quota=Number(config.TENANT_UPLOAD_QUOTA_BYTES||1073741824);
  if(!Number.isSafeInteger(quota)||quota<5242880)throw new Error('TENANT_UPLOAD_QUOTA_BYTES must be an integer of at least 5 MB');
  if(config.BACKUP_PROVIDER&&!['none','local','s3'].includes(config.BACKUP_PROVIDER)) throw new Error('BACKUP_PROVIDER must be none, local or s3');
  if(config.BACKUP_PROVIDER==='s3') {
    for(const key of ['BACKUP_S3_BUCKET','BACKUP_S3_REGION','BACKUP_ENCRYPTION_KEY'])if(!config[key])throw new Error(key+' is required for encrypted offsite backups');
    const key=Buffer.from(config.BACKUP_ENCRYPTION_KEY,'base64');
    if(key.length!==32||new Set(key).size<12)throw new Error('BACKUP_ENCRYPTION_KEY must be a random 32-byte base64 key');
    const retention=Number(config.BACKUP_RETENTION_DAYS||30);
    if(!Number.isInteger(retention)||retention<7||retention>365)throw new Error('BACKUP_RETENTION_DAYS must be 7–365');
    if(!/^[a-zA-Z0-9/_-]+\/$/.test(config.BACKUP_S3_PREFIX||'evolix-backups/'))throw new Error('Invalid BACKUP_S3_PREFIX');
    if(config.BACKUP_S3_ENDPOINT&&new URL(config.BACKUP_S3_ENDPOINT).protocol!=='https:')throw new Error('Backup object endpoint must use HTTPS');
  }
  if(config.EMAIL_PROVIDER&&!['none','smtp'].includes(config.EMAIL_PROVIDER))throw new Error('EMAIL_PROVIDER must be none or smtp');
  if(config.EMAIL_PROVIDER==='smtp') {
    for(const key of ['SMTP_HOST','SMTP_PORT','EMAIL_FROM','PUBLIC_APP_URL'])if(!config[key])throw new Error(key+' is required for email delivery');
    if(mode==='production'&&new URL(config.PUBLIC_APP_URL).protocol!=='https:')throw new Error('PUBLIC_APP_URL must use HTTPS');
    if(mode==='production'&&config.SMTP_SECURE!=='true'&&config.SMTP_REQUIRE_TLS!=='true')throw new Error('Production SMTP requires TLS');
  }
  if(config.GOOGLE_CLIENT_ID&&!/^[\w.-]+\.apps\.googleusercontent\.com$/.test(config.GOOGLE_CLIENT_ID))throw new Error('GOOGLE_CLIENT_ID must be a Google OAuth client ID');
  if(config.WEBSITE_ORIGIN) {
    let website:URL;try{website=new URL(config.WEBSITE_ORIGIN);}catch{throw new Error('WEBSITE_ORIGIN must be a valid origin');}
    if(!['http:','https:'].includes(website.protocol)||website.origin!==config.WEBSITE_ORIGIN||website.username||website.password||(mode==='production'&&website.protocol!=='https:'))throw new Error('WEBSITE_ORIGIN must be an exact origin, HTTPS in production');
  }
  if(config.RETAIL_COOKIE_DOMAIN) {
    const parent=String(config.RETAIL_COOKIE_DOMAIN).replace(/^\./,'');
    if(!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z][a-z0-9-]*$/i.test(parent)||parent==='localhost')throw new Error('RETAIL_COOKIE_DOMAIN must be a domain owned by the application');
    for(const key of ['FRONTEND_ORIGIN','WEBSITE_ORIGIN']) {
      let origin:URL;try{origin=new URL(config[key]);}catch{throw new Error(key+' is required for shared retailer cookies');}
      if(origin.hostname!==parent&&!origin.hostname.endsWith('.'+parent))throw new Error(key+' must belong to RETAIL_COOKIE_DOMAIN');
    }
  }
  if(config.SMS_PROVIDER&&!['none','twilio'].includes(config.SMS_PROVIDER))throw new Error('SMS_PROVIDER must be none or twilio');
  if(config.SMS_PROVIDER==='twilio') {
    for(const key of ['TWILIO_ACCOUNT_SID','TWILIO_AUTH_TOKEN'])if(!config[key])throw new Error(key+' is required for mobile OTP');
    if(!config.TWILIO_MESSAGING_SERVICE_SID&&!config.TWILIO_FROM)throw new Error('A Twilio messaging service or sending number is required');
  }
  return {...config,NODE_ENV:mode};
}
