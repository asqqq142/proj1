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
    Rc: ['', [Validators.required, this.positiveNumberOnly()]],
    Rkh: ['', [Validators.required, this.positiveNumberOnly()]],
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

      const toNum = (val: any): number => parseFloat(String(val).replace(',', '.'));

      const _Rkv = toNum(Rkv);
      const _H = toNum(H);
      const _Lh = toNum(Lh);
      const _Rkh = toNum(Rkh);
      const _Rc = toNum(Rc);
      const _v = toNum(v);
      const _Ppl = toNum(Ppl);
      const _deltaP = toNum(deltaP);
      const _Av = toNum(Av);
      const _Bv = toNum(Bv);

      const h1: number = _H / 2 - _Rc;
      const A: number = _Av * Math.PI * h1 / Math.log(_Rkv / _Rc);
      const B: number = 2 * _Bv * (Math.PI * h1)**2 / (1 / _Rc - 1 / _Rkv);

      const Ah = (A / (2 * _Lh)) * (
        (2 / (_v * h1)) * (_v * h1 + _Rc * Math.log(_Rc / (_Rc + _v * h1))) +
        (_Rkh - _v * h1) / (_Rc + _v * h1)
      );

      const Bh = B / (8 * _Lh ** 2) * (
        (2 / (_v * h1)) * (
          Math.log((_Rc + _v * h1) / _Rc) -
          (_v * h1) / (_Rc + _v * h1)
        ) +
        (_Rkh - _v * h1) / Math.pow((_Rc + _v * h1), 2)
      );

      const discriminant = Ah ** 2 + 4 * Bh * (_Ppl ** 2 - (_Ppl - _deltaP) ** 2);

      if (discriminant < 0 || isNaN(discriminant)) {
        console.warn('❌ Подкоренное выражение отрицательное или нечисло:', discriminant);
        this.result = [
          `h₁ = ${h1.toFixed(3)} м`,
          `A* = ${A.toFixed(7)} МПа²·сут·м/тыс.м³`,
          `B* = ${B.toFixed(7)} МПа²·сут/тыс.м³)²·м³`,
          `Aг = ${Ah.toFixed(7)} МПа²·сут/тыс.м³`,
          `Bг = ${Bh.toExponential(2)} (МПа²·сут/тыс.м³)²`
        ];
        return;
      }

      const debit: number = ((-Ah + Math.sqrt(discriminant)) / (2 * Bh))*2;

      if (isNaN(debit)) {
        console.warn('Итоговый дебит = NaN', { Ah, Bh, discriminant });
      }

      this.result = [
        `h₁ = ${h1.toFixed(3)} м,` +
        `A* = ${A.toFixed(7)} МПа²·сут·м/тыс.м³,` +
        `B* = ${B.toFixed(7)} (МПа²·сут/тыс.м³)²·м³,` +
        `Aг₁=Аг₂= ${Ah.toFixed(7)} МПа²·сут/тыс.м³,` +
        `Bг₁=Вг₂= ${Bh.toExponential(2)} (МПа²·сут/тыс.м³)²,`,
        `Дебит скважины: ${debit.toFixed(2)} тыс.м³/сут`
      ];

      window.scrollTo({ top: 0, behavior: 'smooth' });
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
      if (typeof control.value !== 'string') return { onlyPositive: true };
      const normalized = control.value.replace(',', '.');
      const isValid = /^\d*\.?\d+$/.test(normalized) && parseFloat(normalized) > 0;
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
  private originalResult: string[] | null = null;
  public replaceDotsWithCommas(): void {
    if (!this.originalResult) {
      this.originalResult = [...this.result];
      this.result = this.result.map(line => line.replace(/(\d+)\.(\d+)/g, '$1,$2'));
    } else {
      this.result = [...this.originalResult];
      this.originalResult = null;
    }
  }
}
