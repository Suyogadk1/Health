import unittest
from camera_ready_report import proportion,report
class MetricsTest(unittest.TestCase):
 def test_wilson_extremes(self):
  self.assertAlmostEqual(proportion(4,4)['wilson95'][0],.510109,places=5)
  self.assertIsNone(proportion(0,0)['rate'])
  self.assertGreater(proportion(0,15)['wilson95'][1],.2)
 def test_strata_and_denominators(self):
  def row(i,gold,pred,status):
   return dict(run=1,tier='offline',conversation_id=i,language='Hindi',disclosure_type='implicit',true_label=gold,prediction=pred,classifier_status=status,final_latency_ms=100)
  rows=[row('a','high','none','fallback'),row('b','moderate','high','success'),row('c','none','none','not_called')]
  groups=report(rows); overall=groups[0]
  self.assertEqual(overall['high_risk_misses'],1)
  self.assertEqual(overall['false_escalation']['denominator'],2)
  self.assertEqual(overall['rated_n'],0)
  self.assertEqual(len([g for g in groups if g['group']=='classifier_status']),3)
  with self.assertRaises(ValueError): report(rows+[rows[0]])
if __name__=='__main__': unittest.main()
