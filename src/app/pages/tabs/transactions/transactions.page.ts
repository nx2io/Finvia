import { Component, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonLabel, IonSearchbar, IonToolbar, IonList, IonItemGroup, IonItem, IonSegmentButton, IonSegment, IonTitle, IonThumbnail, IonSegmentContent, IonSegmentView, IonText, IonDatetimeButton, IonModal, IonDatetime, IonChip } from '@ionic/angular/standalone';

import { StatusBar, Style } from '@capacitor/status-bar';


@Component({
  selector: 'app-transactions',
  templateUrl: './transactions.page.html',
  styleUrls: ['./transactions.page.scss'],
  standalone: true,
  imports: [IonChip, IonDatetime, IonModal, IonDatetimeButton, IonText, IonContent, IonHeader, IonLabel, IonSearchbar, IonToolbar, IonList, IonItemGroup, IonItem, IonSegmentButton, IonSegment, IonTitle, IonThumbnail, IonSegmentContent, IonSegmentView, CommonModule, FormsModule],
})
export class TransactionsPage implements OnInit {
  allTransactions: any[] = [];
  features: any[] = [];
  transactionsIn: any[] = [];
  transactionsOut: any[] = [];
  segmentValue = 'in';

  results = [...this.transactionsIn];


  constructor() {}

  async ngOnInit() {
    // await this.setStatusBarStyle();

    this.allTransactions = [
      { id: 1, to: 'Piyush Ag.', date: '2022-05-22', amount: 5000 },
      { id: 2, to: 'Avinash', date: '2022-03-02', amount: 7000 },
      { id: 3, to: 'Catherine', date: '2022-07-28', amount: -3250 },
      { id: 4, to: 'Akhil Ag.', date: '2022-01-09', amount: 1000 },
      { id: 5, to: 'Prem Ag.', date: '2022-04-13', amount: -800 },
      { id: 1, to: 'Piyush Ag.', date: '2022-05-22', amount: 5000 },
      { id: 2, to: 'Avinash', date: '2022-03-02', amount: 7000 },
      { id: 3, to: 'Catherine', date: '2022-07-28', amount: -3250 },
      { id: 4, to: 'Akhil Ag.', date: '2022-01-09', amount: 1000 },
      { id: 5, to: 'Prem Ag.', date: '2022-04-13', amount: -800 },
      { id: 1, to: 'Piyush Ag.', date: '2022-05-22', amount: 5000 },
      { id: 2, to: 'Avinash', date: '2022-03-02', amount: 7000 },
      { id: 3, to: 'Catherine', date: '2022-07-28', amount: -3250 },
      { id: 4, to: 'Akhil Ag.', date: '2022-01-09', amount: 1000 },
      { id: 5, to: 'Prem Ag.', date: '2022-04-13', amount: -800 },
      { id: 1, to: 'Piyush Ag.', date: '2022-05-22', amount: 5000 },
      { id: 2, to: 'Avinash', date: '2022-03-02', amount: 7000 },
      { id: 3, to: 'Catherine', date: '2022-07-28', amount: -3250 },
      { id: 4, to: 'Akhil Ag.', date: '2022-01-09', amount: 1000 },
      { id: 5, to: 'Prem Ag.', date: '2022-04-13', amount: -800 },
      { id: 1, to: 'Piyush Ag.', date: '2022-05-22', amount: 5000 },
      { id: 2, to: 'Avinash', date: '2022-03-02', amount: 7000 },
      { id: 3, to: 'Catherine', date: '2022-07-28', amount: -3250 },
      { id: 4, to: 'Akhil Ag.', date: '2022-01-09', amount: 1000 },
      { id: 5, to: 'Prem Ag.', date: '2022-04-13', amount: -800 },
      { id: 1, to: 'Piyush Ag.', date: '2022-05-22', amount: 5000 },
      { id: 2, to: 'Avinash', date: '2022-03-02', amount: 7000 },
      { id: 3, to: 'Catherine', date: '2022-07-28', amount: -3250 },
      { id: 4, to: 'Akhil Ag.', date: '2022-01-09', amount: 1000 },
      { id: 5, to: 'Prem Ag.', date: '2022-04-13', amount: -800 },
      { id: 1, to: 'Piyush Ag.', date: '2022-05-22', amount: 5000 },
      { id: 2, to: 'Avinash', date: '2022-03-02', amount: 7000 },
      { id: 3, to: 'Catherine', date: '2022-07-28', amount: -3250 },
      { id: 4, to: 'Akhil Ag.', date: '2022-01-09', amount: 1000 },
      { id: 5, to: 'Prem Ag.', date: '2022-04-13', amount: -800 },
      { id: 1, to: 'Piyush Ag.', date: '2022-05-22', amount: 5000 },
      { id: 2, to: 'Avinash', date: '2022-03-02', amount: 7000 },
      { id: 3, to: 'Catherine', date: '2022-07-28', amount: -3250 },
      { id: 4, to: 'Akhil Ag.', date: '2022-01-09', amount: 1000 },
      { id: 5, to: 'Prem Ag.', date: '2022-04-13', amount: -800 },
      { id: 1, to: 'Piyush Ag.', date: '2022-05-22', amount: 5000 },
      { id: 2, to: 'Avinash', date: '2022-03-02', amount: 7000 },
      { id: 3, to: 'Catherine', date: '2022-07-28', amount: -3250 },
      { id: 4, to: 'Akhil Ag.', date: '2022-01-09', amount: 1000 },
      { id: 5, to: 'Prem Ag.', date: '2022-04-13', amount: -800 },
      { id: 1, to: 'Piyush Ag.', date: '2022-05-22', amount: 5000 },
      { id: 2, to: 'Avinash', date: '2022-03-02', amount: 7000 },
      { id: 3, to: 'Catherine', date: '2022-07-28', amount: -3250 },
      { id: 4, to: 'Akhil Ag.', date: '2022-01-09', amount: 1000 },
      { id: 5, to: 'Prem Ag.', date: '2022-04-13', amount: -800 },
      { id: 1, to: 'Piyush Ag.', date: '2022-05-22', amount: 5000 },
      { id: 2, to: 'Avinash', date: '2022-03-02', amount: 7000 },
      { id: 3, to: 'Catherine', date: '2022-07-28', amount: -3250 },
      { id: 4, to: 'Akhil Ag.', date: '2022-01-09', amount: 1000 },
      { id: 5, to: 'Prem Ag.', date: '2022-04-13', amount: -800 },
      { id: 4, to: 'Akhil Ag.', date: '2022-01-09', amount: 1000 },
      { id: 5, to: 'Prem Ag.', date: '2022-04-13', amount: -800 },
      { id: 1, to: 'Piyush Ag.', date: '2022-05-22', amount: 5000 },
      { id: 2, to: 'Avinash', date: '2022-03-02', amount: 7000 },
      { id: 3, to: 'Catherine', date: '2022-07-28', amount: -3250 },
      { id: 4, to: 'Akhil Ag.', date: '2022-01-09', amount: 1000 },
      { id: 5, to: 'Prem Ag.', date: '2022-04-13', amount: -800 },
      { id: 4, to: 'Akhil Ag.', date: '2022-01-09', amount: 1000 },
      { id: 5, to: 'Prem Ag.', date: '2022-04-13', amount: -800 },
      { id: 1, to: 'Piyush Ag.', date: '2022-05-22', amount: 5000 },
      { id: 2, to: 'Avinash', date: '2022-03-02', amount: 7000 },
      { id: 3, to: 'Catherine', date: '2022-07-28', amount: -3250 },
      { id: 4, to: 'Akhil Ag.', date: '2022-01-09', amount: 1000 },
      { id: 5, to: 'AAAAAAA Ag.', date: '2022-04-13', amount: -800 },
    ];
    this.filterTransactions();
  }

  // async ngAfterViewInit() {
  //   // await this.setStatusBarStyle();
  // }

  // private async setStatusBarStyle() {
  //   await StatusBar.setStyle({ style: Style.Dark });
  // }

  handleInput(event: Event) {
    const target = event.target as HTMLIonSearchbarElement;
    const query = target.value?.toLowerCase() || '';
    this.transactionsIn = this.transactionsIn.filter((d) => d.to.toLowerCase().includes(query));
  }

  filterTransactions() {
    this.transactionsIn = this.allTransactions.filter((x) => x.amount >= 0);
    this.transactionsOut = this.allTransactions.filter((x) => x.amount < 0);
  }
}
