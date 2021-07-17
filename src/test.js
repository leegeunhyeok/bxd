const tx = {
  run(...args) {
    console.log('run', ...args);
  },
};

class Box {
  constructor(tx, name) {
    this.tx = tx;
    this.name = name;
  }

  execute(task) {
    return this.tx.run(this.name, task);
  }

  get() {
    return this.execute({
      type: 'get',
    });
  }
}

const b = new Box(tx, 'my_box');
b.get();
