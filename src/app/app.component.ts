import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { Router, Event, NavigationEnd, } from '@angular/router';

import { StatusBar, Style } from '@capacitor/status-bar';

// import { IStaticMethods } from "flyonui/flyonui"

// declare global {
//   interface Window {
//     HSStaticMethods: IStaticMethods
//   }
// }

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent {

  constructor(private router: Router) {}
  ngOnInit() {
    // this.router.events.subscribe((event: Event) => {
    //   if (event instanceof NavigationEnd) {
    //     setTimeout(() => {
    //       if (typeof window !== 'undefined' && window.HSStaticMethods) {
    //         window.HSStaticMethods.autoInit() // No TS warnings/errors now
    //       }
    //     }, 100);
    //   }
    // });
    this.setStatusBarStyleLight()
  }
  async setStatusBarStyleLight() {
    StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setStyle({ style: Style.Dark })
    StatusBar.setBackgroundColor({ color: '#131417' })
  }
}
