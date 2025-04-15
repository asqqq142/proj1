import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CalcDebitComponent } from './entities/components/calc-debit/calc-debit.component';
import { CalcDepComponent } from './entities/components/calc-dep/calc-dep.component';
import { MainComponent } from './entities/components/main/main.component';

const routes: Routes = [
  { path: '', redirectTo: 'main', pathMatch: 'full' },
  { path: 'main', component: MainComponent },
  { path: 'calcDebit', component: CalcDebitComponent },
  { path: 'calcDep', component: CalcDepComponent }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
