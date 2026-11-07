"""Resolve only the trusted Career.Agency webroot or a direct release beneath it."""
import os,pwd,grp,stat
from pathlib import Path

def group_writer_uids(gid):
    names=set(grp.getgrgid(gid).gr_mem)
    names.update(user.pw_name for user in pwd.getpwall() if user.pw_gid==gid)
    return {pwd.getpwnam(name).pw_uid for name in names}

def resolve_public_root(base=Path('/var/www/careeragency'),trusted_uids=None):
    base=Path(base)
    if trusted_uids is None:
        trusted_uids={0}
        try:trusted_uids.add(pwd.getpwnam('ubuntu').pw_uid)
        except KeyError:pass
    def trusted(path,symlink=False):
        info=path.lstat()
        if info.st_uid not in trusted_uids:raise ValueError('untrusted owner: '+str(path))
        if not symlink:
            if info.st_mode & stat.S_IWOTH:raise ValueError('world-writable path: '+str(path))
            if info.st_mode & stat.S_IWGRP:
                try:members=group_writer_uids(info.st_gid)
                except KeyError:raise ValueError('unresolved writer group: '+str(path))
                if not members.issubset(trusted_uids):raise ValueError('untrusted group writers: '+str(path))
    if base.is_symlink() or not base.is_dir():raise ValueError('unexpected application base')
    trusted(base)
    current=base/'current'
    trusted(current,symlink=current.is_symlink())
    target=current.resolve(strict=True)
    if target!=base/'current':
        releases=base/'releases'
        if releases.is_symlink() or not releases.is_dir():raise ValueError('invalid releases directory')
        trusted(releases)
        if target.parent!=releases:raise ValueError('current points outside direct application releases')
    if not target.is_dir():raise ValueError('current is not a directory')
    trusted(target)
    for name in ['index.html','github-sync.js','radar.js','mode-nav.js','feedback.json']:
        path=target/name
        if path.is_symlink():raise ValueError('symlinked public asset: '+name)
        if path.exists():
            if not path.is_file():raise ValueError('unexpected public asset: '+name)
            trusted(path)
        elif name=='index.html':raise ValueError('missing public index')
    return target
if __name__=='__main__':
    try:print(resolve_public_root())
    except (OSError,ValueError) as error:raise SystemExit('public_root=denied: '+str(error))
