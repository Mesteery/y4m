# Y4M

A stream-based [YUV4MPEG2](https://wiki.multimedia.cx/index.php/YUV4MPEG2) (y4m) fast encoder and decoder.

## Examples

This example only decodes the y4m and re-encodes it.

```js
import { createReadStream, createWriteStream } from 'fs';
import { decoder, encoder } from 'y4m';

createReadStream('/path/to/my/video.y4m')
  .pipe(decoder())
  .once('header', function (header) {
    // or using pipeline, see Node.js docs for more info.
    this.pipe(encoder({ header })).pipe(createWriteStream('/path/to/my/video-reconstitution.y4m'));
  });
}
```

### Encoding

```js
import { createWriteStream } from 'fs';
import { encoder as y4mEncoder, Header, Ratio, Frame } from './index.js';

const encoder = y4mEncoder({
	header: new Header({
		width: 2,
		height: 2,
		frameRate: new Ratio(2, 1), // or Ratio.fromString('2:1'), 2 fps
		// these are optional
		aspectRatio: new Ratio(1, 1), // pixel aspect ratio, defaults to 0:0 (unknown)
		interlacing: 'p', // interlacing mode, defaults to 'p' (progressive)
		colourSpace: 'C444', // defaults to 'C420' (YUV 4:4:4)
	}),
});

encoder.pipe(createWriteStream('/path/to/out.y4m'));

// or piping a stream
const frameData = Buffer.alloc(2 * 2 * 3, 128); // yuv444 2x2 frame data
const frame = new Frame(
	frameData,
	Buffer.from('Xthis-a-frame-comment A... B...', 'ascii'), // for example. Optional frame raw parameters.
);

encoder.write(frame);
encoder.end(frame);
```

### Decoding

```js
import { createReadStream } from 'fs';
import { once } from 'events';
import { decoder as y4mDecoder } from 'y4m';

const decoder = createReadStream('/path/to/my/video.y4m').pipe(
	y4mDecoder({
		maxFrameSize: 1024 * 1024, // for example. It is optional and defaults to `Infinity`
	}),
);

const [header] = await once(decoder, 'header');

console.log(header);

// or using async iterator
decoder.on('data', (frame) => {
	// `frame` is a `Frame` object.
	console.log(frame.data.length);
	console.log(frame.rawParameters);
});
```

```js
import { createReadStream } from 'stream';
import { decoder } from 'y4m';

createReadStream('/path/to/my/video.y4m')
  .pipe(decoder());
  .once('header', console.log)
  .on('data', (frame) => {
    // `frame` is a `Frame` object.
    console.log(frame.data.length);
    console.log(frame.rawParameters);
  });
}
```
