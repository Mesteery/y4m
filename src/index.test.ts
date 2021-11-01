import { fileURLToPath, URL } from 'url';
import { join } from 'path';
import { createReadStream } from 'fs';
import { once } from 'events';
import { readFile } from 'fs/promises';
import { Readable } from 'stream';
import * as tap from 'tap';
import { decoder as y4mDecoder, encoder as y4mEncoder, Header, Ratio } from './index.js';

const fixtures = fileURLToPath(new URL('../fixtures', import.meta.url));
const fixture = (name: string) => join(fixtures, name);

async function streamToBuffer(stream: Readable) {
	const chunks = [];
	for await (const chunk of stream) chunks.push(chunk);
	return Buffer.concat(chunks);
}

const claire = await readFile(fixture('sample.y4m'));
tap.test('encode', async (t) => {
	t.plan(1);
	const decoder = createReadStream(fixture('sample.y4m')).pipe(y4mDecoder());
	const [header] = await once(decoder, 'header');
	const out = await streamToBuffer(decoder.pipe(y4mEncoder({ header })));
	t.ok(out.equals(claire));
});

tap.test('decode header', async (t) => {
	t.plan(1);
	const decoder = createReadStream(fixture('claire.y4m')).pipe(y4mDecoder());
	const [header] = await once(decoder, 'header');
	t.strictSame(
		header,
		new Header({
			width: 176,
			height: 144,
			frameRate: new Ratio(6000, 1001),
			interlacing: 'p',
			aspectRatio: new Ratio(128, 117),
			colourSpace: 'Cmono',
		}),
	);
});

tap.test('decode claire', async (t) => {
	t.plan(31);
	let frames = 0;
	const decoder = createReadStream(fixture('claire.y4m')).pipe(y4mDecoder());
	for await (const frame of decoder) {
		frames++;
		t.strictSame(frame.data.length, decoder.header!.colourSpace.frameSize);
	}
	t.strictSame(frames, 30);
});

tap.test('decode sample', async (t) => {
	t.plan(23);
	let frames = 0;
	const decoder = createReadStream(fixture('sample.y4m')).pipe(y4mDecoder());
	for await (const frame of decoder) {
		frames++;
		t.strictSame(frame.data.length, decoder.header!.colourSpace.frameSize);
		t.ok(Buffer.alloc(2 * 2 * 3, 128).equals(frame.data));
		t.ok(Buffer.from('Xthis-a-frame-comment A... B...', 'ascii').equals(frame.rawParameters!));
	}
	t.strictSame(decoder.header!.width, 2);
	t.strictSame(decoder.header!.height, 2);
	t.strictSame(decoder.header!.colourSpace.name, 'C444');
	t.strictSame(decoder.header!.colourSpace.frameSize, 2 * 2 * 3);
	t.strictSame(frames, 6);
});

tap.test('header', async (t) => {
	t.plan(5);
	t.strictSame(
		new Header({
			height: 1,
			width: 1,
			frameRate: new Ratio(1, 1),
		}).toString(),
		'W1 H1 F1:1 Ip A0:0 C420',
	);
	// @ts-expect-error only for testing validation
	t.throws(() => new Header({}), /missing/);
	t.throws(
		() =>
			new Header({
				height: 1,
				width: 1,
				frameRate: new Ratio(1, 1),
				// @ts-expect-error only for testing validation
				interlacing: 'invalid',
			}),
		/interlacing/,
	);
	t.throws(
		() =>
			new Header({
				height: 1,
				width: 1,
				frameRate: new Ratio(1, 1),
				comment: ' ',
			}),
		/illegal/,
	);
	t.throws(
		() =>
			new Header({
				height: 1,
				width: 1,
				frameRate: new Ratio(1, 1),
				// @ts-expect-error only for testing validation
				colourSpace: 'invalid',
			}),
		/unknown/,
	);
});

tap.test('ratio', (t) => {
	t.plan(3);
	t.throws(() => Ratio.fromString('1/1'), /format/);
	t.strictSame(new Ratio(1, 1), Ratio.fromString('1:1'));
	t.strictSame(new Ratio(1, 1).toString(), '1:1');
});
