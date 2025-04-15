import { Component } from '@angular/core';
import {Router} from "@angular/router";


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  constructor(
    private readonly _router: Router,
  ) {
  }
  title = 'proj1';
  /**
   * Обработчик нажатия на кнопку роутинга
   * @param {string} page - страница, на которую необходимо перейти
   */
  public routeToSelectedPage(page: string): void {
    // this._router.navigate([page]);
    if (page === 'main') {
      this._router.navigate(['main']);
    }
    if (page === 'calcDebit') {
      this._router.navigate(['calcDebit']);
    }
    if (page === 'calcDep') {
      this._router.navigate(['calcDep']);
    }
  }
}
