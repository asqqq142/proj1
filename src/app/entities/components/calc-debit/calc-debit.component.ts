import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

@Component({
  selector: 'app-calc-debit',
  templateUrl: './calc-debit.component.html',
  styleUrls: ['./calc-debit.component.scss']
})
export class CalcDebitComponent {
  public result: string[] = [];

  public form: FormGroup = this.fb.group({
    Rkv: ['', [Validators.required, this.positiveNumberOnly()]],
    H: ['', [Validators.required, this.positiveNumberOnly()]],
    Lh: ['', [Validators.required, this.positiveNumberOnly()]],
    Rkh: ['', [Validators.required, this.positiveNumberOnly()]],
    Rc: ['', [Validators.required, this.positiveNumberOnly()]],
    v: ['', [Validators.required, this.positiveNumberOnly()]],
    Ppl: ['', [Validators.required, this.positiveNumberOnly()]],
    deltaP: ['', [Validators.required, this.positiveNumberOnly()]],
    Av: ['', [Validators.required, this.positiveNumberOnly()]],
    Bv: ['', [Validators.required, this.positiveNumberOnly()]]
  });

  constructor(private fb: FormBuilder) {}

  public onSubmit(): void {
    if (this.form.valid) {
      const { Rkv, H, Lh, Rkh, Rc, v, Ppl, deltaP, Av, Bv } = this.form.value;
      const h1: number = (H/2) - Rc;
      const A: number = Av * Math.PI * h1 / Math.log(Rkv/Rc);
      const B: number = 2 * Bv * (Math.PI * h1)**2 / (1/Rc - 1/Rkv);
      const Ah: number = A/2/Lh*(2/h1/v*(h1*v+Rc*Math.log(Rc/(Rc+h1*v)))+(Rkh-v*h1)/(Rc+v*h1));
      const Bh: number = B/8/Lh**2*(2/v/h1*(Math.log((Rc+v*h1)/Rc)-v*h1/(Rc+v*h1)+(Rkh-v*h1)/(Rc+v*h1)**2));
      const debit: number = ((-Ah + (Ah + 4 * Bh * (Ppl**2 - (Ppl- deltaP)**2))**0.5) / 2 / Bh);
      this.result = [
        `h₁ = ${h1.toFixed(4)} м`,
        `A* = ${A.toFixed(7)}`,
        `B* = ${B.toFixed(7)} `,
        `Aг = ${Ah.toFixed(7)}`,
        `Bг = ${Bh.toFixed(7)}`,
        `Дебит скважины: ${debit.toFixed(10)} тыс.м³/сут`
      ];
    }
  }

  public async copyResult(): Promise<void> {
    if (this.result.length > 0) {
      const allText = this.result.join('\n');
      try {
        await navigator.clipboard.writeText(allText);
      } catch (err) {
        console.error('Ошибка при копировании: ', err);
      }
    }
  }



  public positiveNumberOnly(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value;
      const isValid = /^\d*\.?\d+$/.test(value) && parseFloat(value) > 0;
      return isValid ? null : { onlyPositive: true };
    };
  }
  public fields = [
    { name: 'Rkv', label: 'Радиус контура питания вертикальной скважины, м' },
    { name: 'H', label: 'Толщина пласта, м' },
    { name: 'Lh', label: 'Длина горизонтального ствола, м' },
    { name: 'Rc', label: 'Радиус скважины, м' },
    { name: 'Rkh', label: 'Расстояние до границы зоны дренирования, м' },
    { name: 'v', label: 'Анизотропия, д.ед' },
    { name: 'Ppl', label: 'Пластовое давление, МПа' },
    { name: 'deltaP', label: 'Депрессия на пласт, МПа' },
    { name: 'Av', label: 'Аверт, МПа²·сут/тыс.м³' },
    { name: 'Bv', label: 'Вверт, (МПа²·сут/тыс.м³)²' },
  ];

}
