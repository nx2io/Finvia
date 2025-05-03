import { NgStyle } from '@angular/common';
import { Component, EnvironmentInjector, inject, ViewChild } from '@angular/core';
import { RouterModule } from '@angular/router';
import { IonTabs, IonTabBar, IonTabButton, IonLabel } from '@ionic/angular/standalone';

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  imports: [IonLabel, IonTabs, IonTabBar, IonTabButton, RouterModule, NgStyle ],
})
export class TabsPage {
  public environmentInjector = inject(EnvironmentInjector);
  @ViewChild('tabs', {static: false}) tabs!: IonTabs;
  selectedTab: any;

  constructor() { }

  ngOnInit() {
  }

  setCurrentTab() {
    this.selectedTab = this.tabs.getSelected();
    console.log(this.selectedTab);
  }
}
