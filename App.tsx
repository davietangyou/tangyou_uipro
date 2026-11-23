import { Component, type ReactNode } from 'react';
import NewApp from './src/App';
class DataBoundary extends Component<{children:ReactNode},{error:boolean}> {
  state={error:false};
  static getDerivedStateFromError(){return {error:true};}
  render(){return this.state.error ? <main className="flex min-h-screen items-center justify-center bg-app-bg p-5"><section className="max-w-[440px] rounded-[28px] bg-surface p-6 text-ink"><h1 className="hm-cardtitle">資料暫時未能載入</h1><p className="mt-3 hm-body">原有資料已保留，請勿清除瀏覽器資料。您可以重新載入再試。</p><button className="mt-5 min-h-[56px] w-full rounded-[20px] bg-action text-white hm-body" onClick={()=>location.reload()}>重新載入</button></section></main> : this.props.children;}
}
export default function App(){return <DataBoundary><NewApp/></DataBoundary>;}