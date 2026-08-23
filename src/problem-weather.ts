type Clima = 'sol' | 'lluvia';

export class ProblemWeather {
  private readonly panel: HTMLElement;
  private readonly buttons: HTMLButtonElement[];

  constructor(panel: HTMLElement) {
    this.panel = panel;
      this.buttons = Array.from(panel.querySelectorAll<HTMLButtonElement>('[data-clima-choice]'));

      for (const button of this.buttons) {
        const activar = (): void => {
          const clima = button.dataset.climaChoice;
          if (clima === 'sol' || clima === 'lluvia') this.setClima(clima);
        };

        button.addEventListener('click', activar);
        button.addEventListener('pointerenter', activar);
        button.addEventListener('focus', activar);
      }

    this.setClima(this.panel.dataset.clima === 'lluvia' ? 'lluvia' : 'sol');
  }

  private setClima(clima: Clima): void {
    this.panel.dataset.clima = clima;
    for (const button of this.buttons) {
      const active = button.dataset.climaChoice === clima;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    }
  }
}
