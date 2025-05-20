import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage-angular';
import { BehaviorSubject } from 'rxjs';

export const APP_TOKEN = 'app_token';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private _storage: Storage | null = null;
  private userSubject = new BehaviorSubject<any>(null); // 🔹 متغير لحفظ بيانات المستخدم
  user$ = this.userSubject.asObservable(); // 🔹 ملاحظة التغييرات على المستخدم

  constructor(private storage: Storage) {
    this.init();
  }

  async init() {
    this._storage = await this.storage.create();
    // تحميل بيانات المستخدم عند بدء التطبيق
    const userData = await this.getStorage('user');
    if (userData) {
      this.userSubject.next(userData);
    }
  }

  async setStorage(key: string, value: any) {
    if (!this._storage) return;
    await this._storage.set(key, value);
    console.log('Storage set:', key, value);

    // تحديث `BehaviorSubject` إذا تم تحديث بيانات المستخدم
    if (key === 'user') {
      this.userSubject.next(value);
    }
  }

  async getStorage(key: string): Promise<any> {
    if (!this._storage) return null; // تأكد من تهيئة التخزين
    const value = await this._storage.get(key);

    // إذا كان المفتاح هو `user`، نقوم بتحديث `BehaviorSubject`
    if (key === 'user' && value) {
      this.userSubject.next(value);
    }

    return value ?? null; // تجنب إرجاع undefined
  }

  async removeStorage(key: string) {
    if (!this._storage) return;
    await this._storage.remove(key);

    // إذا كان المفتاح `user`، نقوم بتحديث `BehaviorSubject`
    if (key === 'user') {
      this.userSubject.next(null);
    }
  }

  async clearStorage() {
    await this._storage?.clear();
    this.userSubject.next(null); // تصفير بيانات المستخدم عند حذف كل شيء
  }

  async getToken(): Promise<any> {
    return this.getStorage(APP_TOKEN);
  }
}
