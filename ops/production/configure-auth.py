"""Interactive secrets entry on the server. No secret arguments or log output."""
import getpass, json, os, ssl, smtplib, tempfile
from pathlib import Path
from production_rollout import read_env,verify_env
if os.geteuid()!=0:raise SystemExit('Run with sudo')
path=Path('/etc/careeragency/auth.env');values=read_env(path)
for key,label,default in [
 ('CAREER_AUTH_MAIL_FROM','Absender-Adresse','noreply@careeragency.ch'),
 ('CAREER_AUTH_SMTP_HOST','SMTP-Host',''),
 ('CAREER_AUTH_SMTP_PORT','SMTP-Port','587'),
 ('CAREER_AUTH_SMTP_USER','SMTP-Benutzer','')]:
 values[key]=input(label+' ['+values.get(key,default)+']: ').strip() or values.get(key,default)
values['CAREER_AUTH_SMTP_PASS']=getpass.getpass('SMTP-Passwort (leer = bestehendes behalten): ') or values.get('CAREER_AUTH_SMTP_PASS','')
verify_env(values)
with smtplib.SMTP(values['CAREER_AUTH_SMTP_HOST'],int(values['CAREER_AUTH_SMTP_PORT']),timeout=15) as smtp:
 smtp.starttls(context=ssl.create_default_context());smtp.login(values['CAREER_AUTH_SMTP_USER'],values['CAREER_AUTH_SMTP_PASS'])
fd,tmp=tempfile.mkstemp(dir=path.parent,prefix='.auth-env-')
try:
 with os.fdopen(fd,'w') as f:
  for key,value in values.items():f.write(key+'='+json.dumps(value,ensure_ascii=False)+'\n')
 os.chmod(tmp,0o600);os.replace(tmp,path)
finally:
 if os.path.exists(tmp):os.unlink(tmp)
print('SMTP-Anmeldung geprüft und Konfiguration gespeichert. Keine E-Mail versendet.')
