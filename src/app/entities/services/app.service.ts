import { Injectable } from '@angular/core';
import {BehaviorSubject, Observable} from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class AppService {

  private _name$$: BehaviorSubject<string> = new BehaviorSubject<string>('');
  public name$: Observable<string> = this._name$$.asObservable();

  /**
   * Сохранение введенного имени
   * @param {string} name - введенное значение
   */
  public setName(name: string): void {
    this._name$$.next(name);
  }
}
