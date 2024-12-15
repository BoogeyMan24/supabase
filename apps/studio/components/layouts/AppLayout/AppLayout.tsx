import { PropsWithChildren } from 'react'

const AppLayout = ({ children }: PropsWithChildren<{}>) => {
  return (
    <div className="h-screen min-h-[0px] basis-0 flex-1">
      {/* {navLayoutV2 && <AppHeader />} */}
      {children}
    </div>
  )
}

export default AppLayout
