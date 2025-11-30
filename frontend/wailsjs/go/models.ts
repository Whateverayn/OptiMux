export namespace main {
	
	export class ConvertResult {
	    outputPath: string;
	    size: number;
	
	    static createFrom(source: any = {}) {
	        return new ConvertResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.outputPath = source["outputPath"];
	        this.size = source["size"];
	    }
	}
	export class EncodeOptions {
	    codec: string;
	    audio: string;
	    extension: string;
	    outputPath: string;
	    outputDirType: string;
	
	    static createFrom(source: any = {}) {
	        return new EncodeOptions(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.codec = source["codec"];
	        this.audio = source["audio"];
	        this.extension = source["extension"];
	        this.outputPath = source["outputPath"];
	        this.outputDirType = source["outputDirType"];
	    }
	}
	export class MediaInfo {
	    path: string;
	    size: number;
	    hasVideo: boolean;
	    hasAudio: boolean;
	    duration: number;
	
	    static createFrom(source: any = {}) {
	        return new MediaInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.size = source["size"];
	        this.hasVideo = source["hasVideo"];
	        this.hasAudio = source["hasAudio"];
	        this.duration = source["duration"];
	    }
	}

}

