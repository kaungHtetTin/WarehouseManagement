import{r as h,e as z,a as y,j as A}from"./app-560841bd.js";import{g as G,a as K,R,U as M,s as l,j as U,m as C,b as V,c as W,d as B,l as Z}from"./Stack-ea30565b.js";let D=0;function q(r){const[e,t]=h.useState(r),a=r||e;return h.useEffect(()=>{e==null&&(D+=1,t(`mui-${D}`))},[e]),a}const H={...z},I=H.useId;function ar(r){if(I!==void 0){const e=I();return r??e}return q(r)}function J(r){return G("MuiCircularProgress",r)}K("MuiCircularProgress",["root","determinate","indeterminate","colorPrimary","colorSecondary","svg","track","circle","circleDisableShrink"]);const s=44,x=R`
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
`,v=R`
  0% {
    stroke-dasharray: 1px, 200px;
    stroke-dashoffset: 0;
  }

  50% {
    stroke-dasharray: 100px, 200px;
    stroke-dashoffset: -15px;
  }

  100% {
    stroke-dasharray: 1px, 200px;
    stroke-dashoffset: -126px;
  }
`,L=typeof x!="string"?M`
        animation: ${x} 1.4s linear infinite;
      `:null,O=typeof v!="string"?M`
        animation: ${v} 1.4s ease-in-out infinite;
      `:null,Q=r=>{const{classes:e,variant:t,color:a,disableShrink:u}=r,m={root:["root",t,`color${U(a)}`],svg:["svg"],track:["track"],circle:["circle",u&&"circleDisableShrink"]};return B(m,J,e)},X=l("span",{name:"MuiCircularProgress",slot:"Root",overridesResolver:(r,e)=>{const{ownerState:t}=r;return[e.root,e[t.variant],e[`color${U(t.color)}`]]}})(C(({theme:r})=>({display:"inline-block",variants:[{props:{variant:"determinate"},style:{transition:r.transitions.create("transform")}},{props:{variant:"indeterminate"},style:L||{animation:`${x} 1.4s linear infinite`}},...Object.entries(r.palette).filter(Z()).map(([e])=>({props:{color:e},style:{color:(r.vars||r).palette[e].main}}))]}))),Y=l("svg",{name:"MuiCircularProgress",slot:"Svg"})({display:"block"}),_=l("circle",{name:"MuiCircularProgress",slot:"Circle",overridesResolver:(r,e)=>{const{ownerState:t}=r;return[e.circle,t.disableShrink&&e.circleDisableShrink]}})(C(({theme:r})=>({stroke:"currentColor",variants:[{props:{variant:"determinate"},style:{transition:r.transitions.create("stroke-dashoffset")}},{props:{variant:"indeterminate"},style:{strokeDasharray:"80px, 200px",strokeDashoffset:0}},{props:({ownerState:e})=>e.variant==="indeterminate"&&!e.disableShrink,style:O||{animation:`${v} 1.4s ease-in-out infinite`}}]}))),rr=l("circle",{name:"MuiCircularProgress",slot:"Track"})(C(({theme:r})=>({stroke:"currentColor",opacity:(r.vars||r).palette.action.activatedOpacity}))),er=h.forwardRef(function(e,t){const a=V({props:e,name:"MuiCircularProgress"}),{className:u,color:m="primary",disableShrink:j=!1,enableTrackSlot:P=!1,min:N,max:F,size:p=40,style:T,thickness:o=3.6,value:d=a.min??0,variant:S="indeterminate",...E}=a,b=N??0,f=F??100,i={...a,color:m,disableShrink:j,size:p,thickness:o,value:d,variant:S,enableTrackSlot:P},n=Q(i),g={},$={},c={};if(S==="determinate"){const k=2*Math.PI*((s-o)/2),w=f-b;g.strokeDasharray=k.toFixed(3),g.strokeDashoffset=w>0?`${((f-d)/w*k).toFixed(3)}px`:`${k.toFixed(3)}px`,$.transform="rotate(-90deg)",c["aria-valuenow"]=d,c["aria-valuemin"]=b,c["aria-valuemax"]=f}return y(X,{className:W(n.root,u),style:{width:p,height:p,...$,...T},ownerState:i,ref:t,role:"progressbar",...c,...E,children:A(Y,{className:n.svg,ownerState:i,viewBox:`${s/2} ${s/2} ${s} ${s}`,children:[P?y(rr,{className:n.track,ownerState:i,cx:s,cy:s,r:(s-o)/2,fill:"none",strokeWidth:o,"aria-hidden":"true"}):null,y(_,{className:n.circle,style:g,ownerState:i,cx:s,cy:s,r:(s-o)/2,fill:"none",strokeWidth:o})]})})}),or=er;export{or as C,ar as u};
