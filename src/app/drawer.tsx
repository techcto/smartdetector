'use client';
import {ReactNode, useEffect, useRef} from 'react';

export default function Drawer({open,title,onClose,children}:{open:boolean;title:string;onClose:()=>void;children:ReactNode}){
  const ref=useRef<HTMLDivElement>(null),closeRef=useRef(onClose);closeRef.current=onClose;
  useEffect(()=>{
    if(!open)return;
    const previous=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    const focusables=()=>Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')??[]).filter(e=>e.getClientRects().length>0);
    const frame=requestAnimationFrame(()=>{const target=ref.current?.querySelector<HTMLElement>('input:not(:disabled),select:not(:disabled),textarea:not(:disabled)')??focusables()[0]??ref.current;target?.focus()});
    function onKey(e:KeyboardEvent){if(e.key==='Escape'){e.preventDefault();closeRef.current()}if(e.key==='Tab'){const items=focusables(),first=items[0],last=items[items.length-1];if(!first){e.preventDefault();ref.current?.focus()}else if(e.shiftKey&&(document.activeElement===first||!ref.current?.contains(document.activeElement))){e.preventDefault();last.focus()}else if(!e.shiftKey&&(document.activeElement===last||!ref.current?.contains(document.activeElement))){e.preventDefault();first.focus()}}}
    window.addEventListener('keydown',onKey);
    return ()=>{cancelAnimationFrame(frame);window.removeEventListener('keydown',onKey);document.body.style.overflow=overflow;previous?.focus()};
  },[open]);
  return <div ref={ref} className={`offcanvas offcanvas-end smartdetector-drawer${open?' show':''}`} role="dialog" aria-modal={open||undefined} aria-label={title} tabIndex={-1} aria-hidden={!open} style={{visibility:open?'visible':'hidden'}}>
    <div className="offcanvas-header">
      <h5 className="offcanvas-title">{title}</h5>
      <button type="button" className="btn-close" aria-label="Close" onClick={onClose}/>
    </div>
    <div className="offcanvas-body">{children}</div>
  </div>;
}

export function DrawerBackdrop({open,onClose}:{open:boolean;onClose:()=>void}){
  if(!open)return null;
  return <div className="offcanvas-backdrop fade show" onClick={onClose}/>;
}

