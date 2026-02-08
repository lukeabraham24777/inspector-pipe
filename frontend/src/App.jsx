import { useState, useCallback } from 'react';
import { Gauge, Download, AlertCircle, Loader2 } from 'lucide-react';
import FileUpload from './components/FileUpload';
import SummaryCards from './components/SummaryCards';
import PipelineMap from './components/PipelineMap';
import AlignmentChart from './components/AlignmentChart';
import GrowthScatterChart from './components/GrowthScatterChart';
import ClusterChart from './components/ClusterChart';
import CorrosionPredictionChart from './components/CorrosionPredictionChart';
import AnomalyTable from './components/AnomalyTable';
import AnomalyProfile from './components/AnomalyProfile';
import DataProcessingChecklist from './components/DataProcessingChecklist';
import { uploadFile, exportXlsx } from './services/api';

function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedAnomaly, setSelectedAnomaly] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);

  const handleSelectAnomaly = useCallback((row) => {
    setSelectedAnomaly(row);
    setProfileOpen(true);
  }, []);

  const handleCloseProfile = useCallback(() => {
    setProfileOpen(false);
    setSelectedAnomaly(null);
  }, []);

  const handleUpload = async (file) => {
    setIsProcessing(true);
    setError(null);
    try {
      const result = await uploadFile(file);
      setData(result);
    } catch (err) {
      const detail = err.response?.data?.detail || err.message;
      setError(`Processing failed: ${detail}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportXlsx();
    } catch (err) {
      setError('Export failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-base">
      {/* Header */}
      <header className="bg-surface border-b border-edge sticky top-0 z-10">
        <div className="max-w-[1440px] mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent-dim flex items-center justify-center">
              <Gauge className="w-4 h-4 text-accent" />
            </div>
            <div>
              <h1 className="text-[15px] font-semibold text-hi leading-tight tracking-tight">ILI Pipeline Alignment</h1>
              <p className="text-[11px] text-lo">Multi-Year Inspection Analysis</p>
            </div>
          </div>
          {data && (
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="flex items-center gap-2 px-4 py-2 bg-accent text-base rounded-md text-[12px] font-semibold hover:bg-accent-hover disabled:opacity-50 transition-colors focus-ring"
            >
              {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              {isExporting ? 'Exporting...' : 'Export Report'}
            </button>
          )}
        </div>
      </header>

      <main className={`max-w-[1440px] mx-auto px-6 py-6 flex flex-col gap-5 transition-all duration-300 ${profileOpen ? 'mr-96' : ''}`}>
        {/* Upload */}
        <FileUpload onUploadComplete={handleUpload} isProcessing={isProcessing} />

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 px-4 py-3 bg-critical-dim border border-critical/20 rounded-lg">
            <AlertCircle className="w-4 h-4 text-critical flex-shrink-0" />
            <p className="text-[13px] text-critical">{error}</p>
          </div>
        )}

        {/* Results */}
        {data && (
          <>
            {/* Data Processing Checklist */}
            <DataProcessingChecklist summary={data.summary} />

            {/* Summary */}
            <SummaryCards summary={data.summary} />

            {/* Run Stats */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { year: 2007, anomalies: data.summary.total_anomalies_2007, gw: data.summary.total_girth_welds_2007 },
                { year: 2015, anomalies: data.summary.total_anomalies_2015, gw: data.summary.total_girth_welds_2015 },
                { year: 2022, anomalies: data.summary.total_anomalies_2022, gw: data.summary.total_girth_welds_2022 },
              ].map(({ year, anomalies, gw }) => (
                <div key={year} className="card px-4 py-3">
                  <div className="section-label mb-1">Run {year}</div>
                  <div className="text-2xl font-bold text-hi mono">{anomalies}</div>
                  <div className="text-[11px] text-lo mt-0.5">{anomalies} anomalies &middot; {gw} girth welds</div>
                </div>
              ))}
            </div>

            {/* Pipeline Map */}
            <PipelineMap matchedTable={data.matched_table} onSelectAnomaly={handleSelectAnomaly} />

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <AlignmentChart
                corrections2015={data.odometer_corrections_2015}
                corrections2022={data.odometer_corrections_2022}
              />
              <GrowthScatterChart matchedTable={data.matched_table} />
            </div>

            {/* Clustering */}
            <ClusterChart clusterData={data.cluster_data} />

            {/* Corrosion Prediction */}
            <CorrosionPredictionChart predictionData={data.prediction_data} />

            {/* Table */}
            <AnomalyTable matchedTable={data.matched_table} onSelectAnomaly={handleSelectAnomaly} />
          </>
        )}

        {profileOpen && selectedAnomaly && (
          <AnomalyProfile row={selectedAnomaly} onClose={handleCloseProfile} />
        )}
      </main>
    </div>
  );
}

export default App;
