export class ProcessingQueue {
  constructor(processor, concurrency = 2) {
    this.processor = processor;
    this.concurrency = concurrency;
    this.queue = [];
    this.active = 0;
  }

  add(item) {
    this.queue.push(item);
    this.#drain();
  }

  async #drain() {
    while (this.queue.length > 0 && this.active < this.concurrency) {
      const item = this.queue.shift();
      this.active++;
      this.processor(item)
        .catch((err) => console.error(`[queue] Error: ${err.message}`))
        .finally(() => {
          this.active--;
          this.#drain();
        });
    }
  }
}
